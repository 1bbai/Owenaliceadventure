import { describe, expect, it } from 'vitest';
import { countEarned, resultStars } from '../src/game/scoring';

describe('result stars', () => {
  it('awards the finish star and the shard star, keeps the third reserved', () => {
    const r = resultStars({ finished: true, shardsFound: 3, shardsTotal: 3, starsCollected: 10, starsTotal: 100 });
    expect(r.finished).toBe(true);
    expect(r.allShards).toBe(true);
    expect(r.third).toBe(false);
    expect(countEarned(r)).toBe(2);
  });

  it('does not award the shard star for a partial find', () => {
    const r = resultStars({ finished: true, shardsFound: 2, shardsTotal: 3, starsCollected: 0, starsTotal: 100 });
    expect(r.allShards).toBe(false);
    expect(countEarned(r)).toBe(1);
  });
});
