import { CLOUD, DASH, FLOAT, HERO_BODY, JUMP, PICKUP, PIT, QUESTIONS, RESPAWN } from '../config';
import type { HeroDef } from '../heroes';
import { hasGroundAt, nextGroundStart } from '../level/geometry';
import type { Cloud, Level } from '../level/types';
import type { Track } from '../tracks';
import type { SimEvent } from './events';
import {
  cloneLearningState,
  createLearningState,
  hasQuestions,
  inQuestionStretch,
  stepLearning,
  type LearningState,
} from './learning';

/** Everything the simulation needs that does not change during a run. */
export interface SimWorld {
  readonly level: Level;
  readonly track: Track;
  readonly hero: HeroDef;
  /** Seed for the question generator. The same seed gives the same questions. */
  readonly seed?: number;
}

/** One frame of player input: is the single button held right now? */
export interface SimInput {
  held: boolean;
}

export type Surface = { kind: 'ground' } | { kind: 'platform'; id: number } | null;

/** Full mutable state of a run. Plain data so it can be cloned and inspected in tests. */
export interface SimState {
  t: number;
  x: number;
  /** Feet position. 0 is the ground line, negative is up. */
  y: number;
  vy: number;
  grounded: boolean;
  surface: Surface;
  prevHeld: boolean;
  coyote: number;
  buffer: number;
  /** True while the hero is rising from their own jump (the release clamp applies only then). */
  jumping: boolean;
  dashTimer: number;
  canDash: boolean;
  floatTimer: number;
  floating: boolean;
  safeTimer: number;
  checkpointId: number;
  stars: Uint8Array;
  starCount: number;
  streak: number;
  lastStarT: number;
  shards: Uint8Array;
  shardCount: number;
  clouds: Uint8Array;
  respawns: number;
  finished: boolean;
  /** The question stretch (see learning.ts). */
  learning: LearningState;
}

export function createSimState(world: SimWorld): SimState {
  const { level } = world;
  return {
    t: 0,
    x: level.startX,
    y: 0,
    vy: 0,
    grounded: true,
    surface: { kind: 'ground' },
    prevHeld: false,
    coyote: 0,
    buffer: 0,
    jumping: false,
    dashTimer: 0,
    canDash: false,
    floatTimer: 0,
    floating: false,
    safeTimer: 0,
    checkpointId: 0,
    stars: new Uint8Array(level.stars.length),
    starCount: 0,
    streak: 0,
    lastStarT: -Infinity,
    shards: new Uint8Array(level.shards.length),
    shardCount: 0,
    clouds: new Uint8Array(level.clouds.length),
    respawns: 0,
    finished: false,
    learning: createLearningState(world.seed ?? 1),
  };
}

export function cloneSimState(s: SimState): SimState {
  return {
    ...s,
    surface: s.surface ? { ...s.surface } : null,
    stars: new Uint8Array(s.stars),
    shards: new Uint8Array(s.shards),
    clouds: new Uint8Array(s.clouds),
    learning: cloneLearningState(s.learning),
  };
}

/** Run speed at the hero's current position: reduced from the start of the question stretch. */
export function runSpeedAt(world: SimWorld, s: SimState): number {
  return world.track.runSpeed * (inQuestionStretch(world.level, s.x) ? QUESTIONS.speedFactor : 1);
}

/** Centre y of a cloud at time t (bobbing clouds move up and down). */
export function cloudY(cloud: Cloud, t: number): number {
  if (!cloud.bobs) return cloud.y;
  return cloud.y + Math.sin((t / CLOUD.bobPeriod) * Math.PI * 2 + cloud.id) * CLOUD.bobAmplitude;
}

export function isDashing(s: SimState): boolean {
  return s.dashTimer > 0;
}

/** Centre of the hero body, used for pickups. */
export function heroCenter(s: SimState): { x: number; y: number } {
  return { x: s.x, y: s.y - HERO_BODY.height / 2 };
}

function respawn(world: SimWorld, s: SimState, events: SimEvent[]): void {
  const cp = world.level.checkpoints[s.checkpointId] ?? world.level.checkpoints[0]!;
  s.x = cp.x;
  s.y = 0;
  s.vy = 0;
  s.grounded = true;
  s.surface = { kind: 'ground' };
  s.coyote = 0;
  s.buffer = 0;
  s.jumping = false;
  s.dashTimer = 0;
  s.canDash = false;
  s.floatTimer = 0;
  s.floating = false;
  s.safeTimer = RESPAWN.safeTime;
  s.streak = 0;
  s.respawns += 1;
  events.push({ type: 'respawn', checkpointId: cp.id });
}

function land(s: SimState, y: number, surface: Surface, events: SimEvent[]): void {
  s.y = y;
  s.vy = 0;
  s.grounded = true;
  s.surface = surface;
  s.coyote = 0;
  s.jumping = false;
  s.dashTimer = 0;
  s.floating = false;
  s.floatTimer = 0;
  events.push({ type: 'land', surface: surface?.kind === 'platform' ? 'platform' : 'ground' });
}

function popCloud(s: SimState, cloud: Cloud, events: SimEvent[], stomp: boolean): void {
  s.clouds[cloud.id] = 1;
  if (stomp) {
    s.vy = CLOUD.stompBounce;
    s.grounded = false;
    s.surface = null;
    s.coyote = 0;
    s.jumping = false;
    s.canDash = true;
    s.floatTimer = 0;
    s.floating = false;
    s.dashTimer = 0;
    events.push({ type: 'stomp', cloudId: cloud.id });
  } else {
    events.push({ type: 'pop', cloudId: cloud.id });
  }
}

/**
 * Advances the simulation by dt seconds. Mutates `s` and returns the events that happened.
 * dt should be small and fixed (see SIM.fixedDt); the renderer may call it several times per frame.
 */
export function stepSim(world: SimWorld, s: SimState, input: SimInput, dt: number): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.finished) return events;

  const { level, track, hero } = world;
  const held = input.held;
  const pressed = held && !s.prevHeld;
  s.prevHeld = held;
  s.t += dt;

  if (s.coyote > 0) s.coyote = Math.max(0, s.coyote - dt);
  if (s.safeTimer > 0) s.safeTimer = Math.max(0, s.safeTimer - dt);
  if (s.buffer > 0) s.buffer = Math.max(0, s.buffer - dt);
  if (s.dashTimer > 0) s.dashTimer = Math.max(0, s.dashTimer - dt);
  if (pressed) s.buffer = JUMP.bufferTime;

  // Jump (from the ground, or within coyote time of leaving it).
  if (s.buffer > 0 && (s.grounded || s.coyote > 0)) {
    s.vy = track.jumpVelocity;
    s.grounded = false;
    s.surface = null;
    s.coyote = 0;
    s.buffer = 0;
    s.jumping = true;
    s.canDash = true;
    s.floatTimer = 0;
    s.floating = false;
    events.push({ type: 'jump' });
  } else if (pressed && !s.grounded && hero.airAbility === 'dash' && s.canDash && s.dashTimer <= 0) {
    // Owen: tap again in the air for a short forward dash.
    s.dashTimer = DASH.duration;
    s.canDash = false;
    s.jumping = false;
    s.vy = 0;
    s.buffer = 0;
    events.push({ type: 'dash' });
  }

  // Variable jump height: releasing early clamps the upward velocity of the hero's own jump.
  if (s.jumping && !held && s.vy < JUMP.releaseClampVelocity) s.vy = JUMP.releaseClampVelocity;
  if (s.jumping && s.vy >= 0) s.jumping = false;

  const dashing = s.dashTimer > 0;
  const runSpeed = runSpeedAt(world, s);
  const speed = runSpeed * (dashing ? DASH.speedMultiplier : 1);

  if (dashing) {
    s.vy = 0;
  } else if (!s.grounded) {
    s.vy += track.gravity * dt;
    // Alice: keep holding while falling to float down slowly.
    if (hero.airAbility === 'float' && held && s.vy > 0 && s.floatTimer < FLOAT.maxDuration) {
      if (!s.floating) {
        s.floating = true;
        events.push({ type: 'floatStart' });
      }
      s.vy = Math.min(s.vy, FLOAT.maxFallSpeed);
      s.floatTimer += dt;
    } else {
      s.floating = false;
    }
  }

  const prevX = s.x;
  const prevY = s.y;
  s.x += speed * dt;
  if (!s.grounded) s.y += s.vy * dt;

  // Walking off an edge.
  if (s.grounded) {
    const supported =
      s.surface?.kind === 'platform'
        ? (() => {
            const p = level.platforms[s.surface.id]!;
            return s.x >= p.x0 && s.x <= p.x1;
          })()
        : hasGroundAt(level, s.x);
    if (!supported) {
      s.grounded = false;
      s.surface = null;
      s.coyote = JUMP.coyoteTime;
    }
  }

  // Landing (one-way platforms first, then the ground). Only when moving down or level.
  if (!s.grounded && s.vy >= 0) {
    let landed = false;
    for (const p of level.platforms) {
      if (s.x >= p.x0 && s.x <= p.x1 && prevY <= p.y && s.y >= p.y) {
        land(s, p.y, { kind: 'platform', id: p.id }, events);
        landed = true;
        break;
      }
    }
    if (!landed && s.y >= 0 && prevY <= 0 && hasGroundAt(level, s.x)) {
      land(s, 0, { kind: 'ground' }, events);
    }
  }

  // Inside a pit: do not run into the pit wall.
  if (!s.grounded && s.y > 0) {
    const wall = nextGroundStart(level, prevX);
    if (wall !== undefined && s.x >= wall) s.x = wall - 0.01;
    if (s.y >= PIT.depth) {
      if (track.pits === 'bounce') {
        s.y = PIT.depth - 1;
        s.vy = PIT.bounceVelocity;
        s.jumping = false;
        s.dashTimer = 0;
        s.canDash = true;
        s.floatTimer = 0;
        s.floating = false;
        events.push({ type: 'pitBounce' });
      } else {
        respawn(world, s, events);
      }
    }
  }

  // Storm clouds.
  const bodyLeft = s.x - HERO_BODY.width / 2;
  const bodyRight = s.x + HERO_BODY.width / 2;
  const bodyTop = s.y - HERO_BODY.height;
  for (const cloud of level.clouds) {
    if (s.clouds[cloud.id]) continue;
    const cy = cloudY(cloud, s.t);
    const cTop = cy - CLOUD.height / 2;
    const cBottom = cy + CLOUD.height / 2;
    const cLeft = cloud.x - CLOUD.width / 2;
    const cRight = cloud.x + CLOUD.width / 2;
    const overlap = bodyRight > cLeft && bodyLeft < cRight && s.y > cTop && bodyTop < cBottom;
    if (!overlap) continue;

    if (s.dashTimer > 0) {
      popCloud(s, cloud, events, false);
    } else if (s.vy > 0 && prevY <= cTop + CLOUD.stompTolerance) {
      popCloud(s, cloud, events, true);
    } else if (track.clouds === 'harmless') {
      popCloud(s, cloud, events, true);
    } else if (s.safeTimer > 0) {
      // Blinking after a respawn: clouds cannot hurt.
    } else {
      events.push({ type: 'bump', cloudId: cloud.id });
      respawn(world, s, events);
      break;
    }
  }

  // Pickups.
  const cx = s.x;
  const cyHero = s.y - HERO_BODY.height / 2;
  const r2 = hero.pickupRadius * hero.pickupRadius;
  for (const star of level.stars) {
    if (s.stars[star.id]) continue;
    const dx = star.x - cx;
    if (dx > hero.pickupRadius || dx < -hero.pickupRadius) continue;
    const dy = star.y - cyHero;
    if (dx * dx + dy * dy > r2) continue;
    s.stars[star.id] = 1;
    s.starCount += 1;
    s.streak = s.t - s.lastStarT <= PICKUP.streakWindow ? Math.min(s.streak + 1, PICKUP.maxStreak) : 1;
    s.lastStarT = s.t;
    events.push({ type: 'star', id: star.id, streak: s.streak });
  }
  for (const shard of level.shards) {
    if (s.shards[shard.id]) continue;
    const dx = shard.x - cx;
    const dy = shard.y - cyHero;
    if (dx * dx + dy * dy > r2) continue;
    s.shards[shard.id] = 1;
    s.shardCount += 1;
    events.push({ type: 'shard', id: shard.id });
  }

  // Checkpoints.
  for (const cp of level.checkpoints) {
    if (cp.id > s.checkpointId && s.x >= cp.x) {
      s.checkpointId = cp.id;
      events.push({ type: 'checkpoint', id: cp.id });
    }
  }

  // The question stretch: the run never stops. With questions the level ends at the crystal.
  if (hasQuestions(level)) {
    const stretchSpeed = track.runSpeed * QUESTIONS.speedFactor;
    const reachedCrystal = stepLearning(level, s.learning, { track: track.id, x: s.x, y: s.y, speed: stretchSpeed, dt }, events);
    if (reachedCrystal) {
      s.finished = true;
      events.push({ type: 'finish' });
    }
  } else if (s.x >= level.endX) {
    s.finished = true;
    events.push({ type: 'finish' });
  }

  return events;
}
