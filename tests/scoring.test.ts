import { describe, expect, it } from 'vitest';
import { countEarned, grownUpsLine, resultStars, THIRD_STAR_LABEL, type RunOutcome } from '../src/game/scoring';

function outcome(extra: Partial<RunOutcome> = {}): RunOutcome {
  return {
    finished: true,
    shardsFound: 3,
    shardsTotal: 3,
    starsCollected: 10,
    starsTotal: 100,
    gateOpened: true,
    questionsAsked: 3,
    rightFirstTime: 3,
    cluesUsed: 0,
    respawns: 0,
    skills: ['Counting to 5', 'Counting to 8'],
    ...extra,
  };
}

describe('result stars', () => {
  it('awards all three stars for a clean run that opened the gate without a clue', () => {
    const r = resultStars(outcome());
    expect(r.finished).toBe(true);
    expect(r.allShards).toBe(true);
    expect(r.third).toBe(true);
    expect(r.thirdLabel).toBe(THIRD_STAR_LABEL);
    expect(countEarned(r)).toBe(3);
  });

  it('does not award the shard star for a partial find', () => {
    const r = resultStars(outcome({ shardsFound: 2 }));
    expect(r.allShards).toBe(false);
    expect(countEarned(r)).toBe(2);
  });

  it('withholds the third star when a clue was needed or the gate never opened', () => {
    expect(resultStars(outcome({ cluesUsed: 1, rightFirstTime: 2 })).third).toBe(false);
    expect(resultStars(outcome({ gateOpened: false, questionsAsked: 0, rightFirstTime: 0 })).third).toBe(false);
  });

  it('writes the line for grown-ups', () => {
    expect(grownUpsLine(outcome({ cluesUsed: 1, rightFirstTime: 2, respawns: 4 }))).toBe(
      'For grown-ups: skills practised: Counting to 5 and Counting to 8. Right first time 2 of 3. Clues used 1. Retries from a checkpoint 4.',
    );
    expect(grownUpsLine(outcome({ skills: ['Adding within 10'] }))).toContain('skills practised: Adding within 10.');
    expect(grownUpsLine(outcome({ skills: ['a', 'b', 'c'] }))).toContain('a, b and c');
    expect(grownUpsLine(outcome({ skills: [] }))).toContain('none yet');
  });
});
