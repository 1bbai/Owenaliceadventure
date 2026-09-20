import { describe, expect, it } from 'vitest';
import { CLOUD, FLOAT, JUMP, PIT, RESPAWN, SIM } from '../src/game/config';
import { HEROES } from '../src/game/heroes';
import { loadLevel } from '../src/game/level/loadLevel';
import type { Level, LevelJson } from '../src/game/level/types';
import { createSimState, stepSim, type SimWorld } from '../src/game/sim/heroSim';
import { getTrack, type TrackId } from '../src/game/tracks';
import { runFor, runUntil } from './helpers/solver';

const dt = SIM.fixedDt;

/** A tiny test level: flat ground with one pit, one platform, one cloud and a star. No question stretch. */
function tinyLevel(extra: Partial<LevelJson> = {}): Level {
  return loadLevel({
    id: 'test',
    name: 'Test',
    world: 0,
    index: 0,
    startX: 20,
    endX: 2000,
    ground: [
      [-100, 400],
      [470, 3000],
    ],
    platforms: [[600, 700, -70]],
    checkpoints: [20, 900],
    shards: [[650, -100]],
    clouds: [[1200, -26, false]],
    tips: [],
    ...extra,
  });
}

function world(track: TrackId, hero: 'owen' | 'alice', level = tinyLevel()): SimWorld {
  return { level, track: getTrack(track), hero: HEROES[hero] };
}

describe('running and jumping', () => {
  it('runs right automatically at the track run speed', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    runFor(w, s, false, 1);
    expect(s.x).toBeCloseTo(20 + 150, 0);
    expect(s.grounded).toBe(true);
  });

  it('a full-hold jump reaches the analytic apex height and lands again', () => {
    const w = world(1, 'alice');
    const s = createSimState(w);
    const events = runFor(w, s, true, 0.02);
    expect(events.some((e) => e.type === 'jump')).toBe(true);
    let minY = 0;
    for (let i = 0; i < 200; i++) {
      stepSim(w, s, { held: false }, dt);
      minY = Math.min(minY, s.y);
    }
    // A short hold means the release clamp kicks in; hold the whole way for the apex.
    const s2 = createSimState(w);
    let apex = 0;
    let landed = false;
    for (let i = 0; i < 400 && !landed; i++) {
      const ev = stepSim(w, s2, { held: true }, dt);
      apex = Math.min(apex, s2.y);
      if (ev.some((e) => e.type === 'land')) landed = true;
    }
    expect(landed).toBe(true);
    const expected = (520 * 520) / (2 * 1350);
    expect(-apex).toBeGreaterThan(expected - 6);
    expect(-apex).toBeLessThan(expected + 1);
    expect(-minY).toBeLessThan(expected / 2);
  });

  it('releasing early clamps upward velocity to -220', () => {
    const w = world(2, 'owen');
    const s = createSimState(w);
    stepSim(w, s, { held: true }, dt);
    expect(s.vy).toBeLessThan(-500);
    stepSim(w, s, { held: false }, dt);
    expect(s.vy).toBeGreaterThanOrEqual(JUMP.releaseClampVelocity);
  });

  it('a second tap while grounded does nothing new, but holding does not re-jump on landing', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    let jumps = 0;
    for (let i = 0; i < 400; i++) jumps += stepSim(w, s, { held: true }, dt).filter((e) => e.type === 'jump').length;
    expect(jumps).toBe(1);
  });

  it('allows a coyote jump just after running off an edge', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.x = 399.5;
    stepSim(w, s, { held: false }, dt); // steps off the edge at x=400
    expect(s.grounded).toBe(false);
    expect(s.coyote).toBeGreaterThan(0);
    // Wait almost the whole coyote window, then press.
    const waitSteps = Math.floor((JUMP.coyoteTime - 0.02) / dt);
    for (let i = 0; i < waitSteps; i++) stepSim(w, s, { held: false }, dt);
    const ev = stepSim(w, s, { held: true }, dt);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
  });

  it('buffers a press made shortly before landing (Alice; an Owen air tap dashes instead)', () => {
    const w = world(1, 'alice');
    const s = createSimState(w);
    runFor(w, s, true, 0.05); // jump
    // Fall until nearly landed, pressing once in the air 0.05 s before touchdown.
    let pressedAt = -1;
    let landedAt = -1;
    let jumpedAgain = false;
    for (let i = 0; i < 600; i++) {
      const timeToLand = s.vy > 0 ? -s.y / s.vy : 1;
      const held = pressedAt < 0 && s.vy > 0 && timeToLand < 0.05;
      if (held) pressedAt = i;
      const ev = stepSim(w, s, { held: held && pressedAt === i }, dt);
      if (landedAt < 0 && ev.some((e) => e.type === 'land')) landedAt = i;
      if (landedAt >= 0 && ev.some((e) => e.type === 'jump')) {
        jumpedAgain = true;
        break;
      }
    }
    expect(pressedAt).toBeGreaterThan(0);
    expect(jumpedAgain).toBe(true);
  });
});

describe('air abilities', () => {
  it('Owen dashes once per jump at 2.3x speed with vertical velocity held at 0', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    runFor(w, s, true, 0.1);
    stepSim(w, s, { held: false }, dt);
    const ev = stepSim(w, s, { held: true }, dt);
    expect(ev.some((e) => e.type === 'dash')).toBe(true);
    const x0 = s.x;
    const y0 = s.y;
    runFor(w, s, true, 0.2);
    expect(s.y).toBeCloseTo(y0, 5);
    expect(s.x - x0).toBeCloseTo(150 * 2.3 * 0.2, 0);
    // Tap again: no second dash this jump.
    stepSim(w, s, { held: false }, dt);
    const ev2 = stepSim(w, s, { held: true }, dt);
    expect(ev2.some((e) => e.type === 'dash')).toBe(false);
  });

  it('Alice floats: fall speed capped at 70 for at most 1.3 s while holding', () => {
    const w = world(2, 'alice');
    const s = createSimState(w);
    runFor(w, s, true, 0.02);
    s.y = -400; // lift her high so there is room to fall
    s.vy = 0;
    let floatEvents = 0;
    let maxVy = 0;
    const steps = Math.round(1.2 / dt);
    for (let i = 0; i < steps; i++) {
      floatEvents += stepSim(w, s, { held: true }, dt).filter((e) => e.type === 'floatStart').length;
      maxVy = Math.max(maxVy, s.vy);
    }
    expect(floatEvents).toBe(1);
    expect(maxVy).toBeLessThanOrEqual(FLOAT.maxFallSpeed + 0.01);
    // After the float budget runs out, gravity takes over again.
    runFor(w, s, true, 0.4);
    expect(s.floatTimer).toBeGreaterThanOrEqual(FLOAT.maxDuration - 1e-6);
    expect(s.vy).toBeGreaterThan(FLOAT.maxFallSpeed);
  });

  it('Alice does not float while rising and Owen never floats', () => {
    const wa = world(1, 'alice');
    const sa = createSimState(wa);
    stepSim(wa, sa, { held: true }, dt);
    stepSim(wa, sa, { held: true }, dt);
    expect(sa.floating).toBe(false);

    const wo = world(1, 'owen');
    const so = createSimState(wo);
    runFor(wo, so, true, 0.6);
    expect(so.floating).toBe(false);
  });
});

describe('pits', () => {
  it('track 0: a pit bounces the hero back up at -720 from just above the pit floor', () => {
    const w = world(0, 'alice');
    const s = createSimState(w);
    s.x = 398;
    const events = runFor(w, s, false, 1.0);
    expect(events.some((e) => e.type === 'pitBounce')).toBe(true);
    expect(events.some((e) => e.type === 'respawn')).toBe(false);
    expect(s.respawns).toBe(0);
    // Eventually lands on the far side.
    const later = runUntil(w, s, false, 2.0, 'land');
    expect(later).toBe(true);
    expect(s.grounded).toBe(true);
    expect(s.x).toBeGreaterThan(470);
  });

  it('track 1: a pit returns the hero to the last checkpoint, keeping stars', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.starCount = 7;
    s.x = 398;
    const events = runFor(w, s, false, 1.0);
    const resp = events.find((e) => e.type === 'respawn');
    expect(resp).toBeDefined();
    expect(s.starCount).toBeGreaterThanOrEqual(7); // nothing collected is lost
    expect(s.grounded).toBe(true);
    expect(s.y).toBe(0);
    expect(s.safeTimer).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(400);
  });

  it('respawns at the most recent checkpoint passed', () => {
    const w = world(2, 'owen');
    const s = createSimState(w);
    s.x = 890;
    runFor(w, s, false, 0.2); // pass checkpoint 900
    expect(s.checkpointId).toBe(1);
    s.x = 300;
    s.y = PIT.depth + 1;
    s.grounded = false;
    s.surface = null;
    stepSim(w, s, { held: false }, dt);
    expect(s.x).toBe(900);
  });
});

describe('storm clouds', () => {
  it('landing on a cloud from above pops it and bounces the hero at -400', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.x = 1200;
    s.y = -80;
    s.vy = 100;
    s.grounded = false;
    s.surface = null;
    const events = runFor(w, s, false, 0.6);
    expect(events.some((e) => e.type === 'stomp' && e.cloudId === 0)).toBe(true);
    expect(s.clouds[0]).toBe(1);
    const stompIndex = events.findIndex((e) => e.type === 'stomp');
    expect(stompIndex).toBeGreaterThanOrEqual(0);
    expect(events.some((e) => e.type === 'respawn')).toBe(false);
  });

  it('track 0: bumping into a cloud just pops it and bounces the hero', () => {
    const w = world(0, 'alice');
    const s = createSimState(w);
    s.x = 1150;
    const events = runFor(w, s, false, 0.5);
    expect(events.some((e) => e.type === 'stomp')).toBe(true);
    expect(s.respawns).toBe(0);
    expect(s.clouds[0]).toBe(1);
  });

  it('track 1: bumping into a cloud returns the hero to the checkpoint; the cloud stays', () => {
    const w = world(1, 'alice');
    const s = createSimState(w);
    s.x = 1150;
    expect(runUntil(w, s, false, 0.5, 'bump')).toBe(true);
    expect(s.respawns).toBe(1);
    expect(s.clouds[0]).toBe(0);
    expect(s.x).toBe(900);
  });

  it('Owen pops a cloud while dashing through it without being hurt', () => {
    const w = world(2, 'owen');
    const s = createSimState(w);
    s.x = 1100;
    runFor(w, s, true, 0.1);
    stepSim(w, s, { held: false }, dt);
    const ev = stepSim(w, s, { held: true }, dt);
    expect(ev.some((e) => e.type === 'dash')).toBe(true);
    // Put the hero level with the cloud during the dash.
    s.y = -20;
    const events = runFor(w, s, true, 0.3);
    expect(events.some((e) => e.type === 'pop')).toBe(true);
    expect(s.respawns).toBe(0);
  });

  it('a blinking hero cannot be hurt for 1.2 s after a respawn', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.x = 1150;
    expect(runUntil(w, s, false, 0.5, 'respawn')).toBe(true); // bump -> respawn at 900
    expect(s.respawns).toBe(1);
    expect(s.safeTimer).toBeCloseTo(RESPAWN.safeTime, 1);
    s.x = 1150;
    runFor(w, s, false, 0.3);
    expect(s.respawns).toBe(1);
  });

  it('bobbing clouds move up and down by 24 units', () => {
    const level = tinyLevel({ clouds: [[1200, -48, true]] });
    const w = world(1, 'owen', level);
    const s = createSimState(w);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 600; i++) {
      stepSim(w, s, { held: false }, dt);
      const cy = -48 + Math.sin((s.t / CLOUD.bobPeriod) * Math.PI * 2 + 0) * CLOUD.bobAmplitude;
      min = Math.min(min, cy);
      max = Math.max(max, cy);
    }
    expect(max - min).toBeCloseTo(48, 0);
  });
});

describe('platforms and pickups', () => {
  it('lands on a one-way platform from above and passes through it from below', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    s.x = 620;
    s.y = -120;
    s.vy = 0;
    s.grounded = false;
    s.surface = null;
    expect(runUntil(w, s, false, 0.6, 'land')).toBe(true);
    expect(s.surface).toEqual({ kind: 'platform', id: 0 });
    expect(s.y).toBe(-70);

    const s2 = createSimState(w);
    s2.x = 610;
    s2.y = -10;
    s2.vy = -500; // rising through the platform
    s2.grounded = false;
    s2.surface = null;
    for (let i = 0; i < 20; i++) stepSim(w, s2, { held: true }, dt);
    expect(s2.grounded).toBe(false);
    expect(s2.y).toBeLessThan(-70);
  });

  it('collects stars within the pickup radius, Owen from further away', () => {
    const level = tinyLevel();
    const star = level.stars.find((st) => st.kind === 'line')!;
    for (const hero of ['alice', 'owen'] as const) {
      const w = world(1, hero, level);
      const s = createSimState(w);
      s.x = star.x - 200;
      const events = runFor(w, s, false, 2);
      const pick = events.find((e) => e.type === 'star' && e.id === star.id);
      expect(pick).toBeDefined();
    }
    // Radius check: Alice 24, Owen 30.
    const wa = world(1, 'alice', level);
    const sa = createSimState(wa);
    sa.x = star.x;
    sa.y = -(30 - 18) - 27; // centre 27 above the star
    sa.grounded = false;
    sa.surface = null;
    sa.vy = -100;
    stepSim(wa, sa, { held: true }, dt);
    expect(sa.starCount).toBe(0);
    const wo = world(1, 'owen', level);
    const so = createSimState(wo);
    so.x = star.x;
    so.y = -(30 - 18) - 27;
    so.grounded = false;
    so.surface = null;
    so.vy = -100;
    stepSim(wo, so, { held: true }, dt);
    expect(so.starCount).toBe(1);
  });

  it('star streaks rise while pickups are close together and reset after a pause', () => {
    const w = world(1, 'owen');
    const s = createSimState(w);
    const streaks: number[] = [];
    runFor(w, s, false, 6).forEach((e) => {
      if (e.type === 'star') streaks.push(e.streak);
    });
    expect(streaks.length).toBeGreaterThan(3);
    expect(streaks[0]).toBe(1);
    expect(streaks[1]).toBe(2);
    expect(Math.max(...streaks)).toBeGreaterThan(2);
  });

  it('collects the shard and finishes the level', () => {
    const w = world(0, 'alice');
    const s = createSimState(w);
    s.x = 640;
    s.y = -90;
    s.vy = 0;
    s.grounded = false;
    s.surface = null;
    const events = runFor(w, s, false, 0.05);
    expect(events.some((e) => e.type === 'shard')).toBe(true);
    s.x = 1999;
    const ev2 = runFor(w, s, false, 0.1);
    expect(ev2.some((e) => e.type === 'finish')).toBe(true);
    expect(s.finished).toBe(true);
  });
});
