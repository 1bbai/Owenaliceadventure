import type { GroundSegment, Level, Platform } from './types';

/** True when there is ground under x. */
export function hasGroundAt(level: Level, x: number): boolean {
  return level.ground.some((s) => x >= s.x0 && x <= s.x1);
}

/** The ground segment under x, if any. */
export function groundSegmentAt(level: Level, x: number): GroundSegment | undefined {
  return level.ground.find((s) => x >= s.x0 && x <= s.x1);
}

/** Pits: the spaces between consecutive ground segments. */
export function gaps(level: Pick<Level, 'ground'>): GroundSegment[] {
  const sorted = [...level.ground].sort((a, b) => a.x0 - b.x0);
  const out: GroundSegment[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (b.x0 > a.x1) out.push({ x0: a.x1, x1: b.x0 });
  }
  return out;
}

/** The x of the next ground edge (start of a segment) at or after x, used as a pit wall. */
export function nextGroundStart(level: Level, x: number): number | undefined {
  let best: number | undefined;
  for (const s of level.ground) {
    if (s.x0 >= x && (best === undefined || s.x0 < best)) best = s.x0;
  }
  return best;
}

export function platformsUnder(level: Level, x: number): Platform[] {
  return level.platforms.filter((p) => x >= p.x0 && x <= p.x1);
}
