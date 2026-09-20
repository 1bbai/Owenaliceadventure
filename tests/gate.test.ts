import { describe, expect, it } from 'vitest';
import { PARENT_GATE } from '../src/game/config';
import { seededRand } from '../src/game/learning/questions';
import { checkGateAnswer, makeGateQuestion } from '../src/game/profiles/gate';

describe('grown-ups gate', () => {
  it('asks a times-table question with both factors in the 6 to 9 range', () => {
    const rand = seededRand(7);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const q = makeGateQuestion(rand);
      expect(q.a).toBeGreaterThanOrEqual(PARENT_GATE.minFactor);
      expect(q.a).toBeLessThanOrEqual(PARENT_GATE.maxFactor);
      expect(q.b).toBeGreaterThanOrEqual(PARENT_GATE.minFactor);
      expect(q.b).toBeLessThanOrEqual(PARENT_GATE.maxFactor);
      expect(q.answer).toBe(q.a * q.b);
      expect(q.text).toBe(`What is ${q.a} × ${q.b}?`);
      seen.add(q.text);
    }
    expect(seen.size).toBeGreaterThan(8);
  });

  it('accepts only the exact answer', () => {
    const q = { a: 7, b: 8, answer: 56, text: 'What is 7 × 8?' };
    expect(checkGateAnswer(q, '56')).toBe(true);
    expect(checkGateAnswer(q, '056')).toBe(true);
    expect(checkGateAnswer(q, '54')).toBe(false);
    expect(checkGateAnswer(q, '')).toBe(false);
    expect(checkGateAnswer(q, '56x')).toBe(false);
    expect(checkGateAnswer(q, ' 56')).toBe(false);
  });
});
