/**
 * The question stretch, run inside the simulation so the game never stops.
 *
 * From `level.questionStartX` the hero runs at 85% speed. Each question puts
 * three answer bubbles ahead at jump height; jumping into the right one opens
 * a lock on the star gate, a wrong grab or running under all three brings the
 * same question round again with a clue. After three locks the gate and the
 * star crystal are placed ahead, and reaching the crystal finishes the level.
 */
import { HERO_BODY, QUESTIONS } from '../config';
import { generateQuestion, nextLevel, rngNext, type Question, type QuestionLevel } from '../learning/questions';
import type { Level } from '../level/types';
import type { SimEvent } from './events';

export type LearningPhase = 'before' | 'asking' | 'waiting' | 'gate' | 'done';

export interface Bubble {
  id: number;
  x: number;
  y: number;
  value: number;
  correct: boolean;
}

/** Plain data so the sim state stays cloneable and inspectable. */
export interface LearningState {
  phase: LearningPhase;
  level: QuestionLevel;
  /** Open locks so far, 0 to QUESTIONS.locks. */
  locks: number;
  question: Question | null;
  /** 0 on the first try; each wrong grab or miss adds one. */
  attempt: number;
  bubbles: Bubble[];
  /** Counts down between a right answer and the next question. */
  waitTimer: number;
  gateX: number;
  crystalX: number;
  /** Random generator state. */
  rng: number;
  /** For the grown-ups line. */
  asked: number;
  rightFirstTime: number;
  cluesUsed: number;
  skills: string[];
}

export function createLearningState(seed: number): LearningState {
  return {
    phase: 'before',
    level: 0,
    locks: 0,
    question: null,
    attempt: 0,
    bubbles: [],
    waitTimer: 0,
    gateX: 0,
    crystalX: 0,
    rng: seed >>> 0,
    asked: 0,
    rightFirstTime: 0,
    cluesUsed: 0,
    skills: [],
  };
}

export function cloneLearningState(L: LearningState): LearningState {
  return { ...L, bubbles: L.bubbles.map((b) => ({ ...b })), skills: [...L.skills] };
}

export function hasQuestions(level: Level): level is Level & { questionStartX: number } {
  return level.questionStartX !== null;
}

/** True from the start of the question stretch onward (run speed is reduced here). */
export function inQuestionStretch(level: Level, x: number): boolean {
  return hasQuestions(level) && x >= level.questionStartX;
}

function rand(L: LearningState): number {
  const r = rngNext(L.rng);
  L.rng = r.state;
  return r.value;
}

function placeBubbles(L: LearningState, heroX: number, speed: number, firstSeconds: number): void {
  const q = L.question!;
  L.bubbles = q.choices.map((value, i) => ({
    id: i,
    x: heroX + speed * (firstSeconds + i * QUESTIONS.bubbleGapSeconds),
    y: QUESTIONS.bubbleY,
    value,
    correct: value === q.answer,
  }));
}

function askNew(L: LearningState, track: 0 | 1 | 2, heroX: number, speed: number, events: SimEvent[]): void {
  L.question = generateQuestion(track, L.level, () => rand(L));
  L.attempt = 0;
  L.asked += 1;
  if (!L.skills.includes(L.question.skill)) L.skills.push(L.question.skill);
  L.phase = 'asking';
  placeBubbles(L, heroX, speed, QUESTIONS.firstBubbleSeconds);
  events.push({ type: 'questionStart', question: L.question, attempt: 0, bubbles: L.bubbles.map((b) => ({ ...b })), locks: L.locks });
}

/** Same question again, closer, with the sidekick's clue. Nothing is lost. */
function askAgain(L: LearningState, heroX: number, speed: number, events: SimEvent[]): void {
  L.attempt += 1;
  L.cluesUsed += 1;
  placeBubbles(L, heroX, speed, QUESTIONS.retryFirstBubbleSeconds);
  events.push({ type: 'questionStart', question: L.question!, attempt: L.attempt, bubbles: L.bubbles.map((b) => ({ ...b })), locks: L.locks });
}

function rightAnswer(L: LearningState, heroX: number, events: SimEvent[]): void {
  if (L.attempt === 0) L.rightFirstTime += 1;
  L.level = nextLevel(L.level, L.attempt);
  L.locks += 1;
  L.bubbles = [];
  events.push({ type: 'lockOpen', locks: L.locks });
  if (L.locks >= QUESTIONS.locks) {
    L.phase = 'gate';
    L.gateX = heroX + QUESTIONS.gateAhead;
    L.crystalX = L.gateX + QUESTIONS.crystalPastGate;
    events.push({ type: 'gateOpen', gateX: L.gateX, crystalX: L.crystalX });
  } else {
    L.phase = 'waiting';
    L.waitTimer = QUESTIONS.nextQuestionDelay;
  }
}

export interface LearningStepInput {
  track: 0 | 1 | 2;
  /** Hero feet position. */
  x: number;
  y: number;
  /** Current run speed in the stretch (already reduced). */
  speed: number;
  dt: number;
}

/**
 * Advances the question stretch by one step. Returns true when the hero has
 * reached the star crystal (the level is finished).
 */
export function stepLearning(level: Level, L: LearningState, input: LearningStepInput, events: SimEvent[]): boolean {
  if (!hasQuestions(level)) return false;
  const { track, x, y, speed, dt } = input;

  switch (L.phase) {
    case 'before':
      if (x >= level.questionStartX) askNew(L, track, x, speed, events);
      return false;

    case 'asking': {
      const cx = x;
      const cy = y - HERO_BODY.height / 2;
      const r2 = QUESTIONS.grabRadius * QUESTIONS.grabRadius;
      for (const b of L.bubbles) {
        const dx = b.x - cx;
        const dy = b.y - cy;
        if (dx * dx + dy * dy > r2) continue;
        events.push({ type: 'bubbleGrab', bubbleId: b.id, correct: b.correct });
        if (b.correct) rightAnswer(L, x, events);
        else askAgain(L, x, speed, events);
        return false;
      }
      const last = L.bubbles[L.bubbles.length - 1];
      if (last && cx - last.x > QUESTIONS.grabRadius) {
        events.push({ type: 'questionMissed' });
        askAgain(L, x, speed, events);
      }
      return false;
    }

    case 'waiting':
      L.waitTimer -= dt;
      if (L.waitTimer <= 0) askNew(L, track, x, speed, events);
      return false;

    case 'gate':
      if (x >= L.crystalX) {
        L.phase = 'done';
        return true;
      }
      return false;

    case 'done':
      return false;
  }
}

/** True when the gate was opened without ever needing a clue. */
export function openedWithoutClue(L: LearningState): boolean {
  return L.locks >= QUESTIONS.locks && L.cluesUsed === 0;
}
