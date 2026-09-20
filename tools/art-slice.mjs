// Slices the painted art sheets in assets/art/source into transparent PNGs.
//
//   npm run art:slice            slice every sheet
//   npm run art:slice -- owen    slice only sheets whose name contains "owen"
//
// For each sheet (except the full background layers, see SKIP):
//   1. Flood-fill the white background inward from the sheet border, so white
//      paint INSIDE a piece (jacket lining, shoe soles, the unicorn) is kept.
//   2. Give the background a soft edge: pixels of the background band get an
//      alpha from "colour to alpha" (white -> 0, darker -> more opaque) and
//      their colour is un-premultiplied so the edge does not turn grey.
//   3. Find each separate piece as a connected region of opaque pixels, join
//      regions that nearly touch (mergeGap) and pull small fragments such as
//      sparkles or drops into the nearest big piece (absorbGap).
//   4. Trim each piece and write assets/art/sliced/<name>.png, named from
//      assets/art/slice-names.json in reading order (rows top to bottom, then
//      left to right); pieces with no name get <sheet>-NN.
//   5. Write assets/art/sliced/<sheet>.contact.png (every slice with its file
//      name) and assets/art/sliced/slices.json (sheet, box, size per slice).
//
// The script only needs Node and pngjs; no native image tools.

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SOURCE_DIR = path.join(ROOT, 'assets/art/source');
const OUT_DIR = path.join(ROOT, 'assets/art/sliced');
const NAMES_FILE = path.join(ROOT, 'assets/art/slice-names.json');

// Full layers are copied as they are, never sliced.
const SKIP = new Set(['bg-far.png']);

const DEFAULTS = {
  // A pixel joins the background flood when every channel is at least
  // floodMin and the channels differ by at most floodSpread (near white).
  floodMin: 236,
  floodSpread: 16,
  // The background then grows this many pixels into the art; those pixels
  // get the soft "colour to alpha" edge instead of a hard cut.
  edgeBand: 2,
  // A pixel counts as part of a piece when its alpha is at least this.
  solidAlpha: 40,
  // Regions whose boxes are closer than this (pixels) are one piece.
  mergeGap: 6,
  // Regions smaller than absorbArea pixels join the nearest region within
  // absorbGap pixels (sparkles, drops, speed lines).
  absorbArea: 2500,
  absorbGap: 48,
  // Regions smaller than this are noise and are dropped.
  dropArea: 24,
  // Extra transparent pixels around every slice.
  pad: 2,
};

// Per-sheet overrides. The items sheet has glows (star, bubble) painted as
// pale tints, so its background flood is more permissive there.
const SHEET_OPTIONS = {
  'items-and-enemies.png': { floodMin: 150, floodSpread: 255, edgeBand: 1, absorbGap: 70 },
  'sidekicks.png': { absorbGap: 80, absorbArea: 6000 },
};

function readPng(file) {
  return PNG.sync.read(fs.readFileSync(file));
}

function writePng(file, png) {
  fs.writeFileSync(file, PNG.sync.write(png, { deflateLevel: 9 }));
}

// --- background removal -----------------------------------------------------

function removeBackground(png, opt) {
  const { width: w, height: h, data } = png;
  const n = w * h;
  const alpha = new Uint8Array(n).fill(255);
  const nearWhite = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const min = Math.min(r, g, b), max = Math.max(r, g, b);
    return min >= opt.floodMin && max - min <= opt.floodSpread;
  };
  // Flood from the border over near-white pixels (4-connected).
  const bg = new Uint8Array(n);
  const stack = [];
  const push = (i) => {
    if (!bg[i] && nearWhite(i)) { bg[i] = 1; stack.push(i); }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  // Grow the band into the art by edgeBand pixels.
  let band = bg;
  for (let k = 0; k < opt.edgeBand; k++) {
    const next = new Uint8Array(band);
    for (let i = 0; i < n; i++) {
      if (band[i]) continue;
      const x = i % w, y = (i - x) / w;
      if ((x > 0 && band[i - 1]) || (x < w - 1 && band[i + 1]) || (y > 0 && band[i - w]) || (y < h - 1 && band[i + w])) {
        next[i] = 1;
      }
    }
    band = next;
  }
  // Colour to alpha (white) inside the band, then un-premultiply.
  for (let i = 0; i < n; i++) {
    if (!band[i]) continue;
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    const a = Math.max(255 - r, 255 - g, 255 - b) / 255;
    if (a <= 0.004) { alpha[i] = 0; continue; }
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a)));
    data[i * 4] = un(r);
    data[i * 4 + 1] = un(g);
    data[i * 4 + 2] = un(b);
    alpha[i] = Math.round(a * 255);
  }
  for (let i = 0; i < n; i++) data[i * 4 + 3] = alpha[i];
  return alpha;
}

// --- connected regions ---------------------------------------------------------

function labelRegions(alpha, w, h, solidAlpha) {
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const regions = [];
  const stack = [];
  for (let start = 0; start < n; start++) {
    if (label[start] >= 0 || alpha[start] < solidAlpha) continue;
    const id = regions.length;
    const box = { x0: w, y0: h, x1: -1, y1: -1, area: 0, id };
    label[start] = id;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w, y = (i - x) / w;
      box.area++;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y < box.y0) box.y0 = y;
      if (y > box.y1) box.y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (label[j] < 0 && alpha[j] >= solidAlpha) { label[j] = id; stack.push(j); }
        }
      }
    }
    regions.push(box);
  }
  return { label, regions };
}

// Chebyshev distance from every pixel of region `id` to the nearest pixel of
// another group, within `radius`. Returns [groupRoot, distance] or null.
function nearestOther(label, w, h, region, find, radius) {
  let best = null, bestD = radius + 1;
  for (let y = region.y0; y <= region.y1; y++) {
    for (let x = region.x0; x <= region.x1; x++) {
      if (label[y * w + x] !== region.id) continue;
      const me = find(region.id);
      for (let d = 1; d < bestD; d++) {
        // Walk the square ring at distance d.
        for (let k = -d; k <= d; k++) {
          const probes = [[x + k, y - d], [x + k, y + d], [x - d, y + k], [x + d, y + k]];
          for (const [px, py] of probes) {
            if (px < 0 || py < 0 || px >= w || py >= h) continue;
            const l = label[py * w + px];
            if (l >= 0 && find(l) !== me) { bestD = d; best = find(l); }
          }
        }
        if (bestD === d) break;
      }
    }
  }
  return best === null ? null : [best, bestD];
}

// Union-find over regions: join near neighbours, then absorb small fragments.
function groupRegions(label, w, h, regions, opt) {
  const parent = regions.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { parent[find(a)] = find(b); };
  const groupBox = () => {
    const boxes = new Map();
    regions.forEach((r, i) => {
      const g = find(i);
      const b = boxes.get(g);
      if (!b) boxes.set(g, { ...r, id: g });
      else {
        b.x0 = Math.min(b.x0, r.x0); b.y0 = Math.min(b.y0, r.y0);
        b.x1 = Math.max(b.x1, r.x1); b.y1 = Math.max(b.y1, r.y1);
        b.area += r.area;
      }
    });
    return boxes;
  };
  if (process.env.ART_DEBUG) {
    for (const r of regions) if (r.area >= opt.absorbArea) console.log('    region', r.id, r.x0, r.y0, r.x1, r.y1, 'area', r.area);
  }
  // Pass 1: regions whose pixels come within mergeGap of each other are one
  // piece (a soft outline broken by a highlight, for example).
  for (const r of regions) {
    const hit = nearestOther(label, w, h, r, find, opt.mergeGap);
    if (hit) union(r.id, hit[0]);
  }
  // Pass 2: small pieces (sparkles, drops, speed lines) join the nearest
  // group within absorbGap.
  const groupArea = new Map();
  for (const [g, b] of groupBox()) groupArea.set(g, b.area);
  for (const r of regions) {
    const g = find(r.id);
    if (groupArea.get(g) >= opt.absorbArea) continue;
    const hit = nearestOther(label, w, h, r, find, opt.absorbGap);
    if (hit) union(r.id, hit[0]);
  }
  const groups = [...groupBox().values()].filter((g) => g.area >= opt.dropArea);
  return { groups, groupOf: (regionId) => find(regionId) };
}

// Reading order: rows by vertical overlap, then left to right.
function readingOrder(groups) {
  const rows = [];
  for (const g of [...groups].sort((a, b) => a.y0 - b.y0)) {
    const cy = (g.y0 + g.y1) / 2;
    const row = rows.find((r) => cy >= r.y0 && cy <= r.y1);
    if (row) { row.items.push(g); row.y0 = Math.min(row.y0, g.y0); row.y1 = Math.max(row.y1, g.y1); }
    else rows.push({ y0: g.y0, y1: g.y1, items: [g] });
  }
  rows.sort((a, b) => a.y0 - b.y0);
  return rows.flatMap((r) => r.items.sort((a, b) => a.x0 - b.x0));
}

// --- slice output ---------------------------------------------------------------

function cutSlice(png, label, groupOf, group, pad) {
  const w = group.x1 - group.x0 + 1 + pad * 2;
  const h = group.y1 - group.y0 + 1 + pad * 2;
  const out = new PNG({ width: w, height: h });
  out.data.fill(0);
  for (let y = group.y0; y <= group.y1; y++) {
    for (let x = group.x0; x <= group.x1; x++) {
      const i = y * png.width + x;
      const a = png.data[i * 4 + 3];
      if (a === 0) continue;
      // Solid pixels must belong to this group; soft edge pixels are shared.
      const l = label[i];
      if (l >= 0 && groupOf(l) !== group.id) continue;
      const o = ((y - group.y0 + pad) * w + (x - group.x0 + pad)) * 4;
      out.data[o] = png.data[i * 4];
      out.data[o + 1] = png.data[i * 4 + 1];
      out.data[o + 2] = png.data[i * 4 + 2];
      out.data[o + 3] = a;
    }
  }
  return out;
}

// --- contact sheet ----------------------------------------------------------------

// 5 x 7 pixel font, enough for file names.
const FONT = {
  A: '0E 11 11 1F 11 11 11', B: '1E 11 11 1E 11 11 1E', C: '0E 11 10 10 10 11 0E', D: '1E 11 11 11 11 11 1E',
  E: '1F 10 10 1E 10 10 1F', F: '1F 10 10 1E 10 10 10', G: '0E 11 10 17 11 11 0F', H: '11 11 11 1F 11 11 11',
  I: '0E 04 04 04 04 04 0E', J: '07 02 02 02 02 12 0C', K: '11 12 14 18 14 12 11', L: '10 10 10 10 10 10 1F',
  M: '11 1B 15 15 11 11 11', N: '11 11 19 15 13 11 11', O: '0E 11 11 11 11 11 0E', P: '1E 11 11 1E 10 10 10',
  Q: '0E 11 11 11 15 12 0D', R: '1E 11 11 1E 14 12 11', S: '0F 10 10 0E 01 01 1E', T: '1F 04 04 04 04 04 04',
  U: '11 11 11 11 11 11 0E', V: '11 11 11 11 11 0A 04', W: '11 11 11 15 15 15 0A', X: '11 11 0A 04 0A 11 11',
  Y: '11 11 11 0A 04 04 04', Z: '1F 01 02 04 08 10 1F', 0: '0E 11 13 15 19 11 0E', 1: '04 0C 04 04 04 04 0E',
  2: '0E 11 01 02 04 08 1F', 3: '1F 02 04 02 01 11 0E', 4: '02 06 0A 12 1F 02 02', 5: '1F 10 1E 01 01 11 0E',
  6: '06 08 10 1E 11 11 0E', 7: '1F 01 02 04 08 08 08', 8: '0E 11 11 0E 11 11 0E', 9: '0E 11 11 0F 01 02 0C',
  '-': '00 00 00 1F 00 00 00', '.': '00 00 00 00 00 0C 0C', '_': '00 00 00 00 00 00 1F', ' ': '00 00 00 00 00 00 00',
  '?': '0E 11 01 02 04 00 04', ':': '00 0C 0C 00 0C 0C 00', '/': '01 01 02 04 08 10 10', '(': '02 04 08 08 08 04 02',
  ')': '08 04 02 02 02 04 08',
};

function drawText(png, text, x0, y0, scale, rgb) {
  let x = x0;
  for (const ch of text.toUpperCase()) {
    const rows = (FONT[ch] ?? FONT['?']).split(' ').map((s) => parseInt(s, 16));
    rows.forEach((bits, ry) => {
      for (let cx = 0; cx < 5; cx++) {
        if (!(bits & (0x10 >> cx))) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) setPixel(png, x + cx * scale + sx, y0 + ry * scale + sy, rgb, 255);
        }
      }
    });
    x += 6 * scale;
  }
}

function setPixel(png, x, y, [r, g, b], a) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const o = (y * png.width + x) * 4;
  png.data[o] = r; png.data[o + 1] = g; png.data[o + 2] = b; png.data[o + 3] = a;
}

// Nearest-neighbour "over" blit scaled to fit a cell, on a checkerboard.
function blitFit(dst, src, cx, cy, cw, ch) {
  const scale = Math.min(1, cw / src.width, ch / src.height);
  const dw = Math.max(1, Math.round(src.width * scale));
  const dh = Math.max(1, Math.round(src.height * scale));
  const ox = cx + Math.floor((cw - dw) / 2), oy = cy + Math.floor((ch - dh) / 2);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.floor(x / scale));
      const sy = Math.min(src.height - 1, Math.floor(y / scale));
      const s = (sy * src.width + sx) * 4;
      const a = src.data[s + 3] / 255;
      if (a === 0) continue;
      const d = ((oy + y) * dst.width + ox + x) * 4;
      for (let c = 0; c < 3; c++) dst.data[d + c] = Math.round(src.data[s + c] * a + dst.data[d + c] * (1 - a));
      dst.data[d + 3] = 255;
    }
  }
}

function contactSheet(entries) {
  const CELL = 200, LABEL = 40, GAP = 8, COLS = Math.min(5, Math.max(1, entries.length));
  const rows = Math.ceil(entries.length / COLS);
  const w = COLS * (CELL + GAP) + GAP;
  const h = rows * (CELL + LABEL + GAP) + GAP;
  const sheet = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = ((x >> 4) + (y >> 4)) & 1 ? 200 : 170;
      setPixel(sheet, x, y, [v, v, v], 255);
    }
  }
  entries.forEach((e, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    const x = GAP + col * (CELL + GAP), y = GAP + row * (CELL + LABEL + GAP);
    blitFit(sheet, e.png, x, y, CELL, CELL);
    for (let ly = 0; ly < LABEL; ly++) for (let lx = 0; lx < CELL; lx++) setPixel(sheet, x + lx, y + CELL + ly, [30, 30, 40], 255);
    // Two lines of 16 characters each.
    drawText(sheet, e.name.slice(0, 16), x + 4, y + CELL + 4, 2, [255, 255, 255]);
    drawText(sheet, e.name.slice(16, 32), x + 4, y + CELL + 22, 2, [255, 255, 255]);
  });
  return sheet;
}

// --- main ---------------------------------------------------------------------------

function loadNames() {
  if (!fs.existsSync(NAMES_FILE)) return {};
  return JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));
}

function sliceSheet(file, names) {
  const sheet = path.basename(file, '.png');
  const opt = { ...DEFAULTS, ...(SHEET_OPTIONS[path.basename(file)] ?? {}) };
  const png = readPng(file);
  const alpha = removeBackground(png, opt);
  const { label, regions } = labelRegions(alpha, png.width, png.height, opt.solidAlpha);
  const { groups, groupOf } = groupRegions(label, png.width, png.height, regions, opt);
  const ordered = readingOrder(groups);
  const wanted = names[sheet] ?? [];
  const entries = ordered.map((g, i) => {
    const name = wanted[i] ?? `${sheet}-${String(i + 1).padStart(2, '0')}`;
    const cut = cutSlice(png, label, groupOf, g, opt.pad);
    writePng(path.join(OUT_DIR, `${name}.png`), cut);
    return {
      name, png: cut,
      info: { sheet, file: `${name}.png`, box: [g.x0, g.y0, g.x1 - g.x0 + 1, g.y1 - g.y0 + 1], size: [cut.width, cut.height], area: g.area },
    };
  });
  writePng(path.join(OUT_DIR, `${sheet}.contact.png`), contactSheet(entries));
  const warn = [];
  if (wanted.length && wanted.length !== ordered.length) {
    warn.push(`expected ${wanted.length} pieces (slice-names.json) but found ${ordered.length}`);
  }
  console.log(`${sheet}: ${ordered.length} pieces${warn.length ? '  !! ' + warn.join('; ') : ''}`);
  for (const e of entries) {
    const [x, y, w, h] = e.info.box;
    console.log(`  ${e.name.padEnd(28)} at ${String(x).padStart(4)},${String(y).padStart(4)}  ${w} x ${h}`);
  }
  return entries.map((e) => e.info);
}

function main() {
  const filter = process.argv[2] ?? '';
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = loadNames();
  const files = fs.readdirSync(SOURCE_DIR).filter((f) => f.endsWith('.png') && f.includes(filter)).sort();
  const all = [];
  for (const f of files) {
    if (SKIP.has(f)) { console.log(`${f}: full layer, not sliced`); continue; }
    all.push(...sliceSheet(path.join(SOURCE_DIR, f), names));
  }
  const manifestFile = path.join(OUT_DIR, 'slices.json');
  const previous = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : [];
  const touched = new Set(all.map((s) => s.sheet));
  const merged = [...previous.filter((s) => !touched.has(s.sheet)), ...all];
  fs.writeFileSync(manifestFile, JSON.stringify(merged, null, 2) + '\n');
  console.log(`wrote ${merged.length} slices to ${path.relative(ROOT, OUT_DIR)}`);
}

main();
