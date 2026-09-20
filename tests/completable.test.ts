import { describe, expect, it } from 'vitest';
import { HEROES, HERO_IDS } from '../src/game/heroes';
import { loadFirstLevel } from '../src/game/levels';
import type { SimWorld } from '../src/game/sim/heroSim';
import { TRACKS } from '../src/game/tracks';
import { replayPlan, solveLevel } from './helpers/solver';

/**
 * Headless proof that World 1 Level 1 can be completed on every age track with
 * both heroes, and that every hidden shard is reachable. A hop-graph search
 * drives the real simulation; the plan it finds is replayed from scratch so the
 * proof is the replay, not the search.
 */
const level = loadFirstLevel();

describe('Sunny Meadows 1 is completable', () => {
  for (const track of TRACKS) {
    for (const heroId of HERO_IDS) {
      it(`finishes with all 3 shards and no respawn: ${HEROES[heroId].name} on track ${track.id} (${track.label})`, () => {
        const world: SimWorld = { level, track, hero: HEROES[heroId] };
        const result = solveLevel(world, { wantAllShards: true });
        expect(
          result.finished,
          `search did not finish; best x=${result.best.x.toFixed(0)} shards=${result.best.shardCount}`,
        ).toBe(true);

        const { state, events } = replayPlan(world, result.plan);
        expect(state.finished).toBe(true);
        expect(state.shardCount).toBe(level.shards.length);
        expect(state.respawns).toBe(0);
        expect(events.filter((e) => e.type === 'shard')).toHaveLength(level.shards.length);
        // A reasonable run also picks up a good share of the stars along the way.
        expect(state.starCount).toBeGreaterThan(level.stars.length * 0.4);
      });
    }
  }

  it('each shard is reachable on its own on the strictest track (Alice, no dash)', () => {
    const world: SimWorld = { level, track: TRACKS[2]!, hero: HEROES.alice };
    const result = solveLevel(world, { wantAllShards: true });
    expect(result.finished).toBe(true);
    const { events } = replayPlan(world, result.plan);
    const ids = events.filter((e) => e.type === 'shard').map((e) => (e.type === 'shard' ? e.id : -1));
    expect(ids.sort()).toEqual([0, 1, 2]);
  });
});
