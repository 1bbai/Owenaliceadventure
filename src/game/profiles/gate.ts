/**
 * The grown-ups gate: one multiplication question typed on a number pad.
 * Both factors come from the 6 to 9 tables, which the game never asks a child
 * (the hardest child question uses factors 2 to 5).
 */
import { PARENT_GATE } from '../config';
import { randInt, TIMES, type Rand } from '../learning/questions';

export interface GateQuestion {
  a: number;
  b: number;
  answer: number;
  /** For example "What is 7 × 8?" */
  text: string;
}

export function makeGateQuestion(rand: Rand): GateQuestion {
  const a = randInt(rand, PARENT_GATE.minFactor, PARENT_GATE.maxFactor);
  const b = randInt(rand, PARENT_GATE.minFactor, PARENT_GATE.maxFactor);
  return { a, b, answer: a * b, text: `What is ${a} ${TIMES} ${b}?` };
}

/** True when the typed digits are exactly the answer (leading zeros allowed, anything else not). */
export function checkGateAnswer(q: GateQuestion, typed: string): boolean {
  return /^\d+$/.test(typed) && Number(typed) === q.answer;
}
