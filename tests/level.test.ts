import { describe, expect, it } from 'vitest';
import w1l1 from '../src/data/levels/w1l1.json';
import { loadLevel, tipAt } from '../src/game/level/loadLevel';
import { gaps, hasGroundAt } from '../src/game/level/geometry';
import type { LevelJson } from '../src/game/level/types';
import { HEROES } from '../src/game/heroes';

const level = loadLevel(w1l1 as LevelJson);

describe('World 1 Level 1 data', () => {
  it('loads with the expected geometry', () => {
    expect(level.name).toBe('Sunny Meadows 1');
    expect(level.ground).toHaveLength(10);
    expect(level.platforms).toHaveLength(7);
    expect(level.checkpoints.map((c) => c.x)).toEqual([40, 2500, 3850, 5000, 6250]);
    expect(level.shards).toHaveLength(3);
    expect(level.clouds).toHaveLength(7);
    expect(level.clouds.filter((c) => c.bobs)).toHaveLength(3);
    expect(level.endX).toBe(7600);
    expect(level.questionStartX).toBe(6990);
  });

  it('has nine pits, all narrower than a full jump', () => {
    const g = gaps(level);
    expect(g).toHaveLength(9);
    for (const gap of g) expect(gap.x1 - gap.x0).toBeLessThanOrEqual(90);
  });

  it('generates roughly 120 to 135 stars', () => {
    expect(level.stars.length).toBeGreaterThanOrEqual(120);
    expect(level.stars.length).toBeLessThanOrEqual(135);
  });

  it('places five-star arcs over every gap and every cloud, and rows over platforms', () => {
    const by = (kind: string) => level.stars.filter((s) => s.kind === kind).length;
    expect(by('gapArc')).toBe(9 * 5);
    expect(by('cloudArc')).toBe(7 * 5);
    expect(by('platformRow')).toBe(7 * 3);
    expect(by('line')).toBeGreaterThan(0);
  });

  it('keeps line stars 30 units above solid ground and out of the question stretch', () => {
    for (const s of level.stars.filter((st) => st.kind === 'line')) {
      expect(s.y).toBe(-30);
      expect(hasGroundAt(level, s.x)).toBe(true);
      expect(s.x).toBeLessThan(level.questionStartX);
    }
  });

  it('gives every star a unique id and no two stars the same spot', () => {
    const ids = new Set(level.stars.map((s) => s.id));
    expect(ids.size).toBe(level.stars.length);
    const spots = new Set(level.stars.map((s) => `${s.x},${s.y}`));
    expect(spots.size).toBe(level.stars.length);
  });

  it('shows tips by position, with the hero air tip filled in', () => {
    expect(tipAt(level, 100, 'x')).toBe('Tap anywhere to jump.');
    expect(tipAt(level, 700, 'x')).toBe('Hold longer to jump higher.');
    expect(tipAt(level, 1200, 'x')).toBe('Land on a grumpy cloud to pop it.');
    expect(tipAt(level, 2000, HEROES.owen.airTip)).toBe(HEROES.owen.airTip);
    expect(tipAt(level, 2000, HEROES.alice.airTip)).toBe(HEROES.alice.airTip);
    expect(tipAt(level, 3000, 'x')).toBeNull();
  });

  it('rejects broken level data', () => {
    const bad = { ...(w1l1 as LevelJson), checkpoints: [930] };
    expect(() => loadLevel(bad)).toThrow(/checkpoint/);
    const overlapping = { ...(w1l1 as LevelJson), ground: [[0, 100], [50, 200]] as [number, number][] };
    expect(() => loadLevel(overlapping)).toThrow(/overlap/);
  });
});
