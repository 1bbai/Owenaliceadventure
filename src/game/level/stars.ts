import { CLOUD, STAR_LAYOUT as L } from '../config';
import { gaps } from './geometry';
import type { Level, Star } from './types';

/**
 * Generates the star layout for a level from its geometry, deterministically:
 *  - lines of stars 30 units above the ground along flat stretches,
 *  - arcs of 5 stars over every gap and every cloud,
 *  - short rows above each floating platform.
 * Stars are data, not code, so the same level always produces the same stars.
 */
export function generateStars(level: Omit<Level, 'stars'>): Star[] {
  const stars: Star[] = [];
  let nextId = 0;
  const push = (x: number, y: number, kind: Star['kind']) => {
    stars.push({ id: nextId++, x: Math.round(x), y: Math.round(y), kind });
  };

  // Arcs over gaps.
  for (const g of gaps(level)) {
    const x0 = g.x0 - L.gapArcOverhang;
    const x1 = g.x1 + L.gapArcOverhang;
    const n = L.gapArcHeights.length;
    for (let i = 0; i < n; i++) {
      push(x0 + ((x1 - x0) * i) / (n - 1), L.gapArcHeights[i]!, 'gapArc');
    }
  }

  // Arcs over clouds (above the highest point a bobbing cloud reaches).
  for (const c of level.clouds) {
    const top = c.y - CLOUD.height / 2 - (c.bobs ? CLOUD.bobAmplitude : 0);
    const n = L.cloudArcHeights.length;
    for (let i = 0; i < n; i++) {
      const x = c.x + (i - (n - 1) / 2) * L.cloudArcSpacing;
      push(x, top + L.cloudArcLift + L.cloudArcHeights[i]!, 'cloudArc');
    }
  }

  // Short rows above platforms.
  for (const p of level.platforms) {
    const n = L.platformRowCount;
    const x0 = p.x0 + L.platformRowInset;
    const x1 = p.x1 - L.platformRowInset;
    for (let i = 0; i < n; i++) {
      push(x0 + ((x1 - x0) * i) / (n - 1), p.y + L.platformRowLift, 'platformRow');
    }
  }

  // Lines along flat stretches, avoiding places already covered by arcs or rows.
  const gapList = gaps(level);
  for (const seg of level.ground) {
    const from = Math.max(seg.x0 + L.lineMargin, level.startX + L.lineMargin);
    const to = Math.min(seg.x1 - L.lineMargin, level.questionStartX - L.lineMargin);
    const start = Math.ceil(from / L.lineSpacing) * L.lineSpacing;
    for (let x = start; x <= to; x += L.lineSpacing) {
      const nearGap = gapList.some(
        (g) => x > g.x0 - L.lineGapClearance && x < g.x1 + L.lineGapClearance,
      );
      if (nearGap) continue;
      if (level.clouds.some((c) => Math.abs(c.x - x) < L.lineCloudClearance)) continue;
      if (
        level.platforms.some(
          (p) => x > p.x0 - L.linePlatformClearance && x < p.x1 + L.linePlatformClearance,
        )
      )
        continue;
      push(x, L.lineHeight, 'line');
    }
  }

  stars.sort((a, b) => a.x - b.x || a.y - b.y);
  return stars.map((s, i) => ({ ...s, id: i }));
}
