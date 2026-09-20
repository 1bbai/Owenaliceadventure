import { QUESTIONS, SIM } from '../../src/game/config';
import type { SimEvent } from '../../src/game/sim/events';
import { stepSim, type SimState, type SimWorld } from '../../src/game/sim/heroSim';
import type { Bubble } from '../../src/game/sim/learning';

/** What the scripted player does with each set of bubbles. */
export type Answer = 'right' | 'wrong' | 'miss';

export interface TimedEvent {
  t: number;
  x: number;
  event: SimEvent;
}

/**
 * Drives the hero through the question stretch like a child would: run, and
 * jump (full hold to the apex) so the body passes through the chosen bubble.
 * Each entry of `answers` is used for one set of bubbles (a fresh question or
 * the same one coming round again); after the list runs out the player is
 * always right, so the run always ends at the crystal.
 */
export function runQuestionStretch(world: SimWorld, s: SimState, answers: Answer[], maxSeconds = 90): TimedEvent[] {
  const dt = SIM.fixedDt;
  const speed = world.track.runSpeed * QUESTIONS.speedFactor;
  // Horizontal distance covered between takeoff and the apex of a full jump.
  const jumpAhead = speed * (-world.track.jumpVelocity / world.track.gravity);
  const timeline: TimedEvent[] = [];
  const player: { target: Bubble | null } = { target: null };
  let next = 0;
  const pick = (bubbles: Bubble[]): void => {
    const answer = answers[next++] ?? 'right';
    player.target =
      answer === 'right'
        ? (bubbles.find((b) => b.correct) ?? null)
        : answer === 'wrong'
          ? (bubbles.find((b) => !b.correct) ?? null)
          : null;
  };
  // A question may already be up if the caller stepped into the stretch before handing over.
  if (s.learning.phase === 'asking') pick(s.learning.bubbles);
  const steps = Math.round(maxSeconds / dt);

  for (let i = 0; i < steps && !s.finished; i++) {
    // Jump when the chosen bubble is within reach; hold to the apex, then let go (no float, no dash).
    const target = player.target;
    const held = s.grounded ? target !== null && target.x - s.x <= jumpAhead : s.vy < 0;
    const events = stepSim(world, s, { held }, dt);
    for (const event of events) {
      timeline.push({ t: s.t, x: s.x, event });
      if (event.type === 'questionStart') pick(event.bubbles);
      if (event.type === 'bubbleGrab' || event.type === 'questionMissed' || event.type === 'gateOpen') player.target = null;
    }
  }
  return timeline;
}

export function ofType<T extends SimEvent['type']>(timeline: TimedEvent[], type: T): (TimedEvent & { event: Extract<SimEvent, { type: T }> })[] {
  return timeline.filter((e): e is TimedEvent & { event: Extract<SimEvent, { type: T }> } => e.event.type === type);
}
