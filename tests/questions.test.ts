import { describe, expect, it } from 'vitest';
import {
  clueLine,
  COUNTING_RANGE,
  DISTRACTOR_SPREAD,
  generateQuestion,
  LEVELS,
  makeChoices,
  nextLevel,
  rngNext,
  seededRand,
  skillName,
  speechText,
  TIMES,
  type Question,
} from '../src/game/learning/questions';
import { TRACKS } from '../src/game/tracks';

const SAMPLES = 400;

function sample(track: 0 | 1 | 2, level: 0 | 1 | 2, seed = 7): Question[] {
  const rand = seededRand(seed);
  const out: Question[] = [];
  for (let i = 0; i < SAMPLES; i++) out.push(generateQuestion(track, level, rand));
  return out;
}

/** Reads the numbers out of the question text, in order. */
function numbersIn(text: string): number[] {
  return (text.match(/\d+/g) ?? []).map(Number);
}

describe('every question', () => {
  for (const track of TRACKS) {
    for (const level of LEVELS) {
      it(`track ${track.id} level ${level}: answer present once, three unique valid choices, distractors nearby`, () => {
        for (const q of sample(track.id, level)) {
          expect(q.track).toBe(track.id);
          expect(q.level).toBe(level);
          expect(q.skill).toBe(skillName(track.id, level));
          expect(q.choices).toHaveLength(3);
          expect(q.choices.filter((c) => c === q.answer)).toHaveLength(1);
          expect(new Set(q.choices).size).toBe(3);
          for (const c of q.choices) {
            expect(Number.isInteger(c)).toBe(true);
            expect(c).toBeGreaterThanOrEqual(0);
            expect(Math.abs(c - q.answer)).toBeLessThanOrEqual(DISTRACTOR_SPREAD);
          }
          expect(q.answer).toBeGreaterThanOrEqual(1);
          expect(q.text.length).toBeGreaterThan(10);
          expect(q.text).not.toContain('-1');
        }
      });
    }
  }

  it('shuffles the answer into every position over many questions', () => {
    const positions = new Set(sample(1, 0).map((q) => q.choices.indexOf(q.answer)));
    expect([...positions].sort()).toEqual([0, 1, 2]);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = sample(2, 1, 3).map((q) => q.text);
    const b = sample(2, 1, 3).map((q) => q.text);
    const c = sample(2, 1, 4).map((q) => q.text);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBeGreaterThan(20);
  });
});

describe('track 0: counting', () => {
  for (const level of LEVELS) {
    it(`level ${level} shows ${COUNTING_RANGE[level]![0]} to ${COUNTING_RANGE[level]![1]} stars and asks how many`, () => {
      const [lo, hi] = COUNTING_RANGE[level]!;
      const seen = new Set<number>();
      for (const q of sample(0, level)) {
        expect(q.text).toBe('Count the stars on the gate. How many are there?');
        expect(q.stars).toBeGreaterThanOrEqual(lo);
        expect(q.stars).toBeLessThanOrEqual(hi);
        expect(q.answer).toBe(q.stars);
        expect(q.clue).toEqual({ kind: 'numberedStars', count: q.stars });
        seen.add(q.stars);
      }
      expect(seen.size).toBe(hi - lo + 1);
    });
  }
});

describe('track 1: adding and taking away', () => {
  it('level 0 adds within 10 with a two-group dot clue', () => {
    for (const q of sample(1, 0)) {
      const [a, b] = numbersIn(q.text);
      expect(q.text).toBe(`The gate needs ${a} + ${b} stars. How many is that?`);
      expect(a!).toBeGreaterThanOrEqual(1);
      expect(b!).toBeGreaterThanOrEqual(1);
      expect(a! + b!).toBeLessThanOrEqual(10);
      expect(q.answer).toBe(a! + b!);
      expect(q.clue).toEqual({ kind: 'dotGroups', groups: [a, b] });
    }
  });

  it('level 1 adds within 20, always past 10', () => {
    for (const q of sample(1, 1)) {
      const [a, b] = numbersIn(q.text);
      expect(q.text).toBe(`The gate needs ${a} + ${b} stars. How many is that?`);
      expect(a! + b!).toBeGreaterThanOrEqual(11);
      expect(a! + b!).toBeLessThanOrEqual(20);
      expect(a!).toBeLessThanOrEqual(10);
      expect(b!).toBeLessThanOrEqual(10);
      expect(q.answer).toBe(a! + b!);
      expect(q.clue).toEqual({ kind: 'dotGroups', groups: [a, b] });
    }
  });

  it('level 2 takes away within 20 with faded dots', () => {
    for (const q of sample(1, 2)) {
      const [total, have] = numbersIn(q.text);
      expect(q.text).toBe(`The gate needs ${total} stars. You already have ${have}. How many more do you need?`);
      expect(total!).toBeLessThanOrEqual(20);
      expect(have!).toBeGreaterThanOrEqual(1);
      expect(have!).toBeLessThan(total!);
      expect(q.answer).toBe(total! - have!);
      expect(q.clue).toEqual({ kind: 'fadedDots', total, faded: have });
    }
  });
});

describe('track 2: times, two-step and sharing', () => {
  it('level 0 multiplies factors 2 to 5 with the real multiplication sign and groups of dots', () => {
    for (const q of sample(2, 0)) {
      const [a, b] = numbersIn(q.text);
      expect(q.text).toBe(`The gate needs ${a} ${TIMES} ${b} stars. How many is that?`);
      expect(q.text).not.toContain('x');
      for (const f of [a!, b!]) {
        expect(f).toBeGreaterThanOrEqual(2);
        expect(f).toBeLessThanOrEqual(5);
      }
      expect(q.answer).toBe(a! * b!);
      expect(q.clue).toEqual({ kind: 'dotGroups', groups: Array(a).fill(b) });
    }
  });

  it('level 1 is a two-step problem with a worked text clue', () => {
    for (const q of sample(2, 1)) {
      const [a, b, have] = numbersIn(q.text);
      expect(q.text).toBe(`The gate needs ${a} ${TIMES} ${b} stars. You have ${have}. How many more do you need?`);
      expect(q.answer).toBe(a! * b! - have!);
      expect(q.answer).toBeGreaterThanOrEqual(1);
      expect(q.clue).toEqual({ kind: 'text', text: `First: ${a} ${TIMES} ${b} = ${a! * b!}. Now work out ${a! * b!} - ${have}.` });
    }
  });

  it('level 2 shares equally with no remainder', () => {
    for (const q of sample(2, 2)) {
      const [total, locks] = numbersIn(q.text);
      expect(q.text).toBe(`${total} stars are shared equally between ${locks} locks. How many stars does each lock get?`);
      expect(total! % locks!).toBe(0);
      expect(q.answer).toBe(total! / locks!);
      expect(q.clue).toEqual({ kind: 'text', text: `Think: ${locks} ${TIMES} ? = ${total}` });
    }
  });
});

describe('difficulty', () => {
  it('goes up one level after a right first try, capped at 2', () => {
    expect(nextLevel(0, 0)).toBe(1);
    expect(nextLevel(1, 0)).toBe(2);
    expect(nextLevel(2, 0)).toBe(2);
  });

  it('stays put after one miss', () => {
    expect(nextLevel(0, 1)).toBe(0);
    expect(nextLevel(1, 1)).toBe(1);
    expect(nextLevel(2, 1)).toBe(2);
  });

  it('goes down one level after two or more misses, floored at 0', () => {
    expect(nextLevel(2, 2)).toBe(1);
    expect(nextLevel(1, 3)).toBe(0);
    expect(nextLevel(0, 2)).toBe(0);
  });
});

describe('helpers', () => {
  it('makeChoices never goes below 1 even for a tiny answer', () => {
    const rand = seededRand(11);
    for (let i = 0; i < 200; i++) {
      const choices = makeChoices(1, rand);
      expect(choices).toHaveLength(3);
      expect(choices.filter((c) => c === 1)).toHaveLength(1);
      expect(Math.min(...choices)).toBeGreaterThanOrEqual(1);
      expect(new Set(choices).size).toBe(3);
    }
  });

  it('names the sidekick in the clue line', () => {
    expect(clueLine('Jackson')).toBe('Jackson has a clue.');
    expect(clueLine('Aliceson')).toBe('Aliceson has a clue.');
  });

  it('turns symbols into words for reading aloud', () => {
    expect(speechText(`The gate needs 4 ${TIMES} 6 stars.`)).toBe('The gate needs 4 times 6 stars.');
    expect(speechText('Now work out 24 - 17.')).toBe('Now work out 24 minus 17.');
    expect(speechText(`Think: 4 ${TIMES} ? = 24`)).toBe('Think: 4 times what = 24');
    expect(speechText('How many are there?')).toBe('How many are there?');
  });

  it('rngNext is a pure step: same state in, same value out', () => {
    expect(rngNext(123)).toEqual(rngNext(123));
    expect(rngNext(123).state).not.toBe(123);
    const values = new Set<number>();
    let state = 5;
    for (let i = 0; i < 1000; i++) {
      const r = rngNext(state);
      state = r.state;
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      values.add(r.value);
    }
    expect(values.size).toBeGreaterThan(990);
  });
});
