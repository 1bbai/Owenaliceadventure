import type { Question } from '../learning/questions';
import type { Bubble } from './learning';

/** Things that happened during one simulation step. The renderer and audio react to these. */
export type SimEvent =
  | { type: 'jump' }
  | { type: 'land'; surface: 'ground' | 'platform' | 'cloud' }
  | { type: 'dash' }
  | { type: 'floatStart' }
  | { type: 'star'; id: number; streak: number }
  | { type: 'shard'; id: number }
  | { type: 'stomp'; cloudId: number }
  | { type: 'pop'; cloudId: number }
  | { type: 'bump'; cloudId: number }
  | { type: 'pitBounce' }
  | { type: 'respawn'; checkpointId: number }
  | { type: 'checkpoint'; id: number }
  | { type: 'finish' }
  /** A question is asked (attempt 0) or comes round again (attempt 1+, with the sidekick's clue). */
  | { type: 'questionStart'; question: Question; attempt: number; bubbles: Bubble[]; locks: number }
  /** The hero jumped into a bubble. */
  | { type: 'bubbleGrab'; bubbleId: number; correct: boolean }
  /** The hero ran under all three bubbles. */
  | { type: 'questionMissed' }
  /** A lock on the star gate opened (1-based count of open locks). */
  | { type: 'lockOpen'; locks: number }
  /** All locks are open: the gate and the crystal are placed ahead. */
  | { type: 'gateOpen'; gateX: number; crystalX: number };
