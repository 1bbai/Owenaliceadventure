/**
 * Question generator for the learning stretch. Pure functions: every question
 * comes from a caller-supplied random source, so tests can seed it and the
 * simulation can carry the random state in plain data.
 *
 * Three tracks (the age tracks) and three difficulty levels inside each track:
 *
 *   track 0  counting            k stars, k in 3-5 / 5-8 / 8-12 by level
 *   track 1  addition within 10  / addition within 20 / subtraction within 20
 *   track 2  multiplication 2-5  / two-step (multiply, then subtract) / division
 *
 * Every question has three answer choices: the answer exactly once and two
 * distractors near it, never negative, never duplicated.
 */
import type { TrackId } from '../tracks';

export type QuestionLevel = 0 | 1 | 2;

/** A random source returning a number in [0, 1), like Math.random. */
export type Rand = () => number;

/** What the sidekick shows when the child needs a clue. Drawn by the banner. */
export type Clue =
  | { kind: 'numberedStars'; count: number }
  | { kind: 'dotGroups'; groups: number[] }
  | { kind: 'fadedDots'; total: number; faded: number }
  | { kind: 'text'; text: string };

export interface Question {
  track: TrackId;
  level: QuestionLevel;
  /** Short skill name for the grown-ups line on the result screen. */
  skill: string;
  /** The text shown in the banner and read aloud. */
  text: string;
  /** Counting questions show this many stars in the banner (0 for the others). */
  stars: number;
  answer: number;
  /** Three choices, shuffled; the answer appears exactly once. */
  choices: number[];
  clue: Clue;
}

/** The real multiplication sign used in every displayed question. */
export const TIMES = '×';

export const LEVELS: readonly QuestionLevel[] = [0, 1, 2];

/** Star counts for the counting track: [min, max] by level. */
export const COUNTING_RANGE: readonly (readonly [number, number])[] = [
  [3, 5],
  [5, 8],
  [8, 12],
];

/** Distractors are within this distance of the right answer. */
export const DISTRACTOR_SPREAD = 3;

export const SKILL_NAMES: readonly (readonly string[])[] = [
  ['Counting to 5', 'Counting to 8', 'Counting to 12'],
  ['Adding within 10', 'Adding within 20', 'Taking away within 20'],
  ['Times tables 2 to 5', 'Two-step problems', 'Sharing equally'],
];

/** Integer in [lo, hi] inclusive. */
export function randInt(rand: Rand, lo: number, hi: number): number {
  return lo + Math.floor(rand() * (hi - lo + 1));
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rand: Rand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i]!;
    out[i] = out[j]!;
    out[j] = a;
  }
  return out;
}

/**
 * Two distractors near the answer: distinct, never equal to the answer, never
 * below 1 (an answer of 0 stars never appears in a question either).
 */
export function makeChoices(answer: number, rand: Rand): number[] {
  const candidates: number[] = [];
  for (let d = -DISTRACTOR_SPREAD; d <= DISTRACTOR_SPREAD; d++) {
    const v = answer + d;
    if (d !== 0 && v >= 1) candidates.push(v);
  }
  // Nearer values come up more often: list the +-1 and +-2 values twice.
  const weighted = candidates.flatMap((v) => (Math.abs(v - answer) <= 2 ? [v, v] : [v]));
  const picked: number[] = [];
  const pool = shuffle(weighted, rand);
  for (const v of pool) {
    if (!picked.includes(v)) picked.push(v);
    if (picked.length === 2) break;
  }
  return shuffle([answer, ...picked], rand);
}

export function skillName(track: TrackId, level: QuestionLevel): string {
  return SKILL_NAMES[track]![level]!;
}

function counting(level: QuestionLevel, rand: Rand): Omit<Question, 'track' | 'level' | 'skill' | 'choices'> {
  const [lo, hi] = COUNTING_RANGE[level]!;
  const k = randInt(rand, lo, hi);
  return {
    text: 'Count the stars on the gate. How many are there?',
    stars: k,
    answer: k,
    clue: { kind: 'numberedStars', count: k },
  };
}

function arithmetic(level: QuestionLevel, rand: Rand): Omit<Question, 'track' | 'level' | 'skill' | 'choices'> {
  if (level === 0) {
    // Addition within 10.
    const a = randInt(rand, 1, 9);
    const b = randInt(rand, 1, 10 - a);
    return {
      text: `The gate needs ${a} + ${b} stars. How many is that?`,
      stars: 0,
      answer: a + b,
      clue: { kind: 'dotGroups', groups: [a, b] },
    };
  }
  if (level === 1) {
    // Addition within 20, always crossing 10 so it is a step up from level 0.
    const sum = randInt(rand, 11, 20);
    const a = randInt(rand, Math.max(2, sum - 10), Math.min(10, sum - 2));
    const b = sum - a;
    return {
      text: `The gate needs ${a} + ${b} stars. How many is that?`,
      stars: 0,
      answer: sum,
      clue: { kind: 'dotGroups', groups: [a, b] },
    };
  }
  // Subtraction within 20: "how many more do you need".
  const total = randInt(rand, 10, 20);
  const have = randInt(rand, 1, total - 1);
  return {
    text: `The gate needs ${total} stars. You already have ${have}. How many more do you need?`,
    stars: 0,
    answer: total - have,
    clue: { kind: 'fadedDots', total, faded: have },
  };
}

function multiplication(level: QuestionLevel, rand: Rand): Omit<Question, 'track' | 'level' | 'skill' | 'choices'> {
  if (level === 0) {
    const a = randInt(rand, 2, 5);
    const b = randInt(rand, 2, 5);
    return {
      text: `The gate needs ${a} ${TIMES} ${b} stars. How many is that?`,
      stars: 0,
      answer: a * b,
      clue: { kind: 'dotGroups', groups: Array<number>(a).fill(b) },
    };
  }
  if (level === 1) {
    // Two-step: multiply, then work out how many more.
    const a = randInt(rand, 2, 5);
    const b = randInt(rand, 2, 6);
    const product = a * b;
    const have = randInt(rand, 1, product - 1);
    return {
      text: `The gate needs ${a} ${TIMES} ${b} stars. You have ${have}. How many more do you need?`,
      stars: 0,
      answer: product - have,
      clue: { kind: 'text', text: `First: ${a} ${TIMES} ${b} = ${product}. Now work out ${product} - ${have}.` },
    };
  }
  // Division: sharing equally between locks.
  const locks = randInt(rand, 2, 5);
  const each = randInt(rand, 2, 6);
  const total = locks * each;
  return {
    text: `${total} stars are shared equally between ${locks} locks. How many stars does each lock get?`,
    stars: 0,
    answer: each,
    clue: { kind: 'text', text: `Think: ${locks} ${TIMES} ? = ${total}` },
  };
}

/** Makes one question for a track at a difficulty level. */
export function generateQuestion(track: TrackId, level: QuestionLevel, rand: Rand): Question {
  const body = track === 0 ? counting(level, rand) : track === 1 ? arithmetic(level, rand) : multiplication(level, rand);
  return {
    track,
    level,
    skill: skillName(track, level),
    ...body,
    choices: makeChoices(body.answer, rand),
  };
}

/**
 * How the difficulty moves after a question:
 * right on the first try goes up one level, two or more misses goes down one.
 */
export function nextLevel(level: QuestionLevel, misses: number): QuestionLevel {
  if (misses === 0) return Math.min(2, level + 1) as QuestionLevel;
  if (misses >= 2) return Math.max(0, level - 1) as QuestionLevel;
  return level;
}

/** The sidekick's one-line clue announcement. */
export function clueLine(sidekickName: string): string {
  return `${sidekickName} has a clue.`;
}

/** Question text as it should be read aloud: symbols become words. */
export function speechText(text: string): string {
  return text.replace(new RegExp(TIMES, 'g'), 'times').replace(/(\d) - (\d)/g, '$1 minus $2').replace(/\?(?= =)/g, 'what');
}

/**
 * Small deterministic random generator (mulberry32) kept as plain numbers so
 * the simulation state stays cloneable data. `next` returns the new state and
 * a value in [0, 1).
 */
export function rngNext(state: number): { state: number; value: number } {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { state: next, value };
}

/** A Rand closure over a seed, for tests and one-off use. */
export function seededRand(seed: number): Rand {
  let state = seed >>> 0;
  return () => {
    const r = rngNext(state);
    state = r.state;
    return r.value;
  };
}
