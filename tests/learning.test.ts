import { describe, expect, it } from 'vitest';
import { QUESTIONS, SIM } from '../src/game/config';
import { HEROES, HERO_IDS } from '../src/game/heroes';
import { loadLevel } from '../src/game/level/loadLevel';
import type { Level } from '../src/game/level/types';
import { resultStars } from '../src/game/scoring';
import { createSimState, runSpeedAt, stepSim, type SimState, type SimWorld } from '../src/game/sim/heroSim';
import { openedWithoutClue } from '../src/game/sim/learning';
import { TRACKS, type TrackId } from '../src/game/tracks';
import { ofType, runQuestionStretch, type Answer } from './helpers/learning';
import { runFor } from './helpers/solver';

/** Flat ground with a question stretch starting at x 400. The level ends at the crystal. */
function learningLevel(): Level {
  return loadLevel({
    id: 'learn',
    name: 'Learning test',
    world: 0,
    index: 0,
    startX: 20,
    endX: 1200,
    questionStartX: 400,
    ground: [[-100, 40000]],
    platforms: [],
    checkpoints: [20],
    shards: [],
    clouds: [],
    tips: [],
  });
}

function world(track: TrackId, hero: 'owen' | 'alice' = 'alice', seed = 42): SimWorld {
  return { level: learningLevel(), track: TRACKS[track]!, hero: HEROES[hero], seed };
}

function play(w: SimWorld, answers: Answer[]): { s: SimState; timeline: ReturnType<typeof runQuestionStretch> } {
  const s = createSimState(w);
  const timeline = runQuestionStretch(w, s, answers);
  return { s, timeline };
}

describe('the question stretch never stops the run', () => {
  it('drops run speed to 85% from questionStartX to the end', () => {
    const w = world(1);
    const s = createSimState(w);
    expect(runSpeedAt(w, s)).toBe(150);
    s.x = 399;
    expect(runSpeedAt(w, s)).toBe(150);
    s.x = 400;
    expect(runSpeedAt(w, s)).toBeCloseTo(150 * 0.85, 6);
    const x0 = s.x;
    runFor(w, s, false, 1);
    expect(s.x - x0).toBeCloseTo(150 * 0.85, 0);
  });

  it('asks the first question as the hero enters the stretch, with three bubbles ahead at jump height', () => {
    const w = world(0);
    const s = createSimState(w);
    const events = runFor(w, s, false, 5);
    const start = events.find((e) => e.type === 'questionStart');
    expect(start).toBeDefined();
    if (!start || start.type !== 'questionStart') return;
    expect(start.attempt).toBe(0);
    expect(start.locks).toBe(0);
    expect(start.bubbles).toHaveLength(3);
    expect(start.bubbles.filter((b) => b.correct)).toHaveLength(1);
    expect(start.bubbles.map((b) => b.value)).toEqual(start.question.choices);
    const speed = 125 * QUESTIONS.speedFactor;
    const heroX = start.bubbles[0]!.x - speed * QUESTIONS.firstBubbleSeconds;
    expect(heroX).toBeGreaterThanOrEqual(400);
    expect(heroX).toBeLessThan(400 + speed * SIM.fixedDt * 2);
    for (let i = 0; i < 3; i++) {
      expect(start.bubbles[i]!.y).toBe(QUESTIONS.bubbleY);
      expect(start.bubbles[i]!.x - start.bubbles[0]!.x).toBeCloseTo(speed * QUESTIONS.bubbleGapSeconds * i, 6);
    }
    // The hero keeps running while the question is up.
    const before = s.x;
    runFor(w, s, false, 0.5);
    expect(s.x - before).toBeCloseTo(speed * 0.5, 0);
    expect(s.learning.phase).toBe('asking');
  });
});

describe('all answers right', () => {
  for (const track of TRACKS) {
    for (const heroId of HERO_IDS) {
      it(`${HEROES[heroId].name} on track ${track.id}: three locks, the gate, the crystal, no clue`, () => {
        const w = world(track.id, heroId);
        const { s, timeline } = play(w, ['right', 'right', 'right']);
        expect(s.finished).toBe(true);
        expect(s.respawns).toBe(0);

        const starts = ofType(timeline, 'questionStart');
        expect(starts).toHaveLength(3);
        expect(starts.map((e) => e.event.attempt)).toEqual([0, 0, 0]);
        expect(starts.map((e) => e.event.locks)).toEqual([0, 1, 2]);
        // Right on the first try each time: the difficulty climbs 0, 1, 2.
        expect(starts.map((e) => e.event.question.level)).toEqual([0, 1, 2]);

        const grabs = ofType(timeline, 'bubbleGrab');
        expect(grabs).toHaveLength(3);
        expect(grabs.every((g) => g.event.correct)).toBe(true);
        expect(ofType(timeline, 'lockOpen').map((e) => e.event.locks)).toEqual([1, 2, 3]);
        expect(ofType(timeline, 'questionMissed')).toHaveLength(0);

        // 0.7 s after a lock opens, the next question starts.
        const locks = ofType(timeline, 'lockOpen');
        for (let i = 0; i < 2; i++) {
          expect(starts[i + 1]!.t - locks[i]!.t).toBeCloseTo(QUESTIONS.nextQuestionDelay, 1);
        }

        // The third lock places the gate 430 ahead and the crystal 190 past it; reaching it finishes.
        const gate = ofType(timeline, 'gateOpen');
        expect(gate).toHaveLength(1);
        expect(gate[0]!.event.gateX).toBeCloseTo(locks[2]!.x + QUESTIONS.gateAhead, 6);
        expect(gate[0]!.event.crystalX).toBe(gate[0]!.event.gateX + QUESTIONS.crystalPastGate);
        const finish = ofType(timeline, 'finish');
        expect(finish).toHaveLength(1);
        expect(finish[0]!.x).toBeGreaterThanOrEqual(gate[0]!.event.crystalX);
        expect(finish[0]!.x).toBeLessThan(gate[0]!.event.crystalX + 5);
        expect(finish[0]!.t).toBeGreaterThan(gate[0]!.t + QUESTIONS.gateLiftSeconds);

        const L = s.learning;
        expect(L.asked).toBe(3);
        expect(L.rightFirstTime).toBe(3);
        expect(L.cluesUsed).toBe(0);
        expect(L.locks).toBe(3);
        expect(L.skills).toHaveLength(3);
        expect(openedWithoutClue(L)).toBe(true);
        const stars = resultStars({
          finished: true,
          shardsFound: 0,
          shardsTotal: 0,
          starsCollected: s.starCount,
          starsTotal: w.level.stars.length,
          gateOpened: L.locks >= 3,
          questionsAsked: L.asked,
          rightFirstTime: L.rightFirstTime,
          cluesUsed: L.cluesUsed,
          respawns: s.respawns,
          skills: L.skills,
        });
        expect(stars.third).toBe(true);
      });
    }
  }

  it('gives the same questions for the same seed', () => {
    const a = play(world(2, 'owen', 9), ['right', 'right', 'right']);
    const b = play(world(2, 'owen', 9), ['right', 'right', 'right']);
    const c = play(world(2, 'owen', 10), ['right', 'right', 'right']);
    const texts = (r: typeof a) => ofType(r.timeline, 'questionStart').map((e) => e.event.question.text);
    expect(texts(a)).toEqual(texts(b));
    expect(texts(a)).not.toEqual(texts(c));
  });
});

describe('one wrong grab', () => {
  it('loses nothing: the same question comes round again 2.0 s ahead with a clue, then the run finishes', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.starCount = 12;
    const timeline = runQuestionStretch(w, s, ['wrong', 'right', 'right', 'right']);
    expect(s.finished).toBe(true);
    expect(s.starCount).toBeGreaterThanOrEqual(12);
    expect(s.respawns).toBe(0);

    const grabs = ofType(timeline, 'bubbleGrab');
    expect(grabs.map((g) => g.event.correct)).toEqual([false, true, true, true]);

    const starts = ofType(timeline, 'questionStart');
    expect(starts).toHaveLength(4);
    expect(starts.map((e) => e.event.attempt)).toEqual([0, 1, 0, 0]);
    expect(starts[1]!.event.question).toEqual(starts[0]!.event.question);
    // The retry is asked at the moment of the wrong grab, first bubble 2.0 s of running ahead.
    const wrong = grabs[0]!;
    expect(starts[1]!.t).toBe(wrong.t);
    const speed = 150 * QUESTIONS.speedFactor;
    expect(starts[1]!.event.bubbles[0]!.x - wrong.x).toBeCloseTo(speed * QUESTIONS.retryFirstBubbleSeconds, 6);
    // Only the grabbed bubble counts; the other bubbles of the first set are gone.
    expect(ofType(timeline, 'questionMissed')).toHaveLength(0);

    // One miss keeps the level where it was; the later right-first-time answers climb.
    expect(starts.map((e) => e.event.question.level)).toEqual([0, 0, 0, 1]);
    expect(ofType(timeline, 'lockOpen').map((e) => e.event.locks)).toEqual([1, 2, 3]);

    const L = s.learning;
    expect(L.asked).toBe(3);
    expect(L.rightFirstTime).toBe(2);
    expect(L.cluesUsed).toBe(1);
    expect(openedWithoutClue(L)).toBe(false);
  });

  it('two misses on one question drop the difficulty a level', () => {
    const { s, timeline } = play(world(2, 'alice'), ['right', 'wrong', 'wrong', 'right', 'right']);
    expect(s.finished).toBe(true);
    const starts = ofType(timeline, 'questionStart');
    expect(starts.map((e) => e.event.attempt)).toEqual([0, 0, 1, 2, 0]);
    expect(starts.map((e) => e.event.question.level)).toEqual([0, 1, 1, 1, 0]);
    expect(s.learning.cluesUsed).toBe(2);
    expect(s.learning.rightFirstTime).toBe(2);
  });
});

describe('one question missed entirely', () => {
  it('running under all three bubbles brings the question round again with a clue; nothing is lost', () => {
    const w = world(0, 'alice');
    const { s, timeline } = play(w, ['miss', 'right', 'right', 'right']);
    expect(s.finished).toBe(true);
    expect(s.respawns).toBe(0);

    const missed = ofType(timeline, 'questionMissed');
    expect(missed).toHaveLength(1);
    const starts = ofType(timeline, 'questionStart');
    expect(starts.map((e) => e.event.attempt)).toEqual([0, 1, 0, 0]);
    expect(starts[1]!.event.question).toEqual(starts[0]!.event.question);
    // No bubble was touched during the first set: the hero ran under them.
    expect(ofType(timeline, 'bubbleGrab').filter((g) => g.t <= missed[0]!.t)).toHaveLength(0);
    // The miss is noticed just after the last bubble is behind the hero.
    const lastBubbleX = starts[0]!.event.bubbles[2]!.x;
    expect(missed[0]!.x - lastBubbleX).toBeGreaterThan(QUESTIONS.grabRadius);
    expect(missed[0]!.x - lastBubbleX).toBeLessThan(QUESTIONS.grabRadius + 3);
    expect(starts[1]!.t).toBe(missed[0]!.t);
    const speed = 125 * QUESTIONS.speedFactor;
    expect(starts[1]!.event.bubbles[0]!.x - missed[0]!.x).toBeCloseTo(speed * QUESTIONS.retryFirstBubbleSeconds, 6);

    expect(ofType(timeline, 'lockOpen')).toHaveLength(3);
    expect(s.learning.cluesUsed).toBe(1);
    expect(s.learning.rightFirstTime).toBe(2);
  });

  it('a short tap is not enough to reach a bubble', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    const events = runFor(w, s, false, 3);
    const start = events.find((e) => e.type === 'questionStart');
    if (!start || start.type !== 'questionStart') throw new Error('no question');
    const first = start.bubbles[0]!;
    // Tap once (one step) just before the bubble, then release.
    while (first.x - s.x > 40) stepSim(w, s, { held: false }, SIM.fixedDt);
    const grabbed: boolean[] = [];
    for (let i = 0; i < 240; i++) {
      for (const e of stepSim(w, s, { held: i === 0 }, SIM.fixedDt)) if (e.type === 'bubbleGrab') grabbed.push(e.correct);
    }
    expect(grabbed).toHaveLength(0);
    expect(s.learning.phase).toBe('asking');
  });
});
