import { SIM } from '../../src/game/config';
import type { SimEvent } from '../../src/game/sim/events';
import { cloneSimState, createSimState, stepSim, type SimState, type SimWorld } from '../../src/game/sim/heroSim';

/**
 * Headless level solver used by the tests.
 *
 * The hero auto-runs, so a run is a chain of "hops": stand on a surface, then
 * either run a little further or jump with some hold length (and, for Owen,
 * an optional air dash) and simulate until the next landing. This searches
 * that hop graph exhaustively in x order, treating any respawn as a failed
 * hop. Whatever plan it finds is a plain list of per-step inputs, so the
 * tests replay it from scratch through the real simulation as the proof.
 */
export interface SolveOptions {
  /** Stop only when every shard is collected and the level is finished. */
  wantAllShards?: boolean;
  /** Ground positions are merged to this many units. */
  quantum?: number;
  /** Physics step. */
  dt?: number;
  /** Give up on a hop that has not landed after this long. */
  maxHopSeconds?: number;
}

export interface SolveResult {
  finished: boolean;
  best: SimState;
  /** Held/released per step for the found run; replaying it reproduces the run. */
  plan: boolean[];
  /** Number of hop graph nodes expanded. */
  expanded: number;
}

interface Node {
  state: SimState;
  parent: Node | null;
  /** Inputs that took the parent state to this one. */
  inputs: boolean[];
}

/** Hold lengths (in physics steps) tried for every jump. The last one holds all the way down (Alice floats). */
const HOLD_STEPS = [6, 12, 18, 24, 36, 48, 62, 1000];
/** Steps after takeoff at which Owen taps again to dash. */
const DASH_STEPS = [24, 44, 66];

function planOf(node: Node): boolean[] {
  const parts: boolean[][] = [];
  for (let n: Node | null = node; n; n = n.parent) parts.push(n.inputs);
  return parts.reverse().flat();
}

function shardMask(s: SimState): number {
  let m = 0;
  for (let i = 0; i < s.shards.length; i++) if (s.shards[i]) m |= 1 << i;
  return m;
}

function surfaceKey(s: SimState): string {
  if (!s.surface) return 'air';
  return s.surface.kind === 'platform' ? `p${s.surface.id}` : 'g';
}

/** True when an uncollected shard is already behind the hero and can never be collected. */
function missedShard(world: SimWorld, s: SimState): boolean {
  return world.level.shards.some((sh) => !s.shards[sh.id] && s.x > sh.x + 60);
}

type HopOutcome = { kind: 'landed' | 'finished'; state: SimState; inputs: boolean[] } | { kind: 'failed' };

/**
 * Simulates one hop from a grounded state: `script` gives the first inputs,
 * after which the button is released. Runs until the hero is grounded again
 * (after having left the ground), the level ends, a respawn happens, or time runs out.
 */
function hop(world: SimWorld, from: SimState, script: boolean[], dt: number, maxSteps: number, runOnly: number): HopOutcome {
  const s = cloneSimState(from);
  const inputs: boolean[] = [];
  let leftGround = false;
  for (let i = 0; i < maxSteps; i++) {
    const held = script[i] ?? false;
    const events = stepSim(world, s, { held }, dt);
    inputs.push(held);
    for (const e of events) {
      if (e.type === 'respawn') return { kind: 'failed' };
    }
    if (s.finished) return { kind: 'finished', state: s, inputs };
    if (!s.grounded) leftGround = true;
    if (runOnly > 0 && !leftGround && s.x >= from.x + runOnly) return { kind: 'landed', state: s, inputs };
    if (leftGround && s.grounded) return { kind: 'landed', state: s, inputs };
  }
  return { kind: 'failed' };
}

function jumpScript(hold: number, dashAt: number | null): boolean[] {
  const len = Math.max(hold, dashAt ?? 0) + 1;
  const script: boolean[] = [];
  for (let i = 0; i < len; i++) script.push(i < hold);
  if (dashAt !== null) {
    // A dash needs a fresh press: release for one step, then press.
    script[dashAt - 1] = false;
    script[dashAt] = true;
    for (let i = dashAt + 1; i < script.length; i++) script[i] = hold > i; // resume holding if still within the hold
  }
  return script;
}

export function solveLevel(world: SimWorld, opts: SolveOptions = {}): SolveResult {
  const wantAllShards = opts.wantAllShards ?? true;
  const Q = opts.quantum ?? 8;
  const dt = opts.dt ?? SIM.fixedDt;
  const maxHopSteps = Math.ceil((opts.maxHopSeconds ?? 6) / dt);
  const shardTotal = world.level.shards.length;
  const scripts: boolean[][] = [];
  for (const hold of HOLD_STEPS) {
    scripts.push(jumpScript(hold, null));
    if (world.hero.airAbility === 'dash') {
      for (const d of DASH_STEPS) if (d > 6) scripts.push(jumpScript(Math.min(hold, d - 2), d));
    }
  }

  const startNode: Node = { state: createSimState(world), parent: null, inputs: [] };
  const buckets = new Map<number, Node[]>();
  const seen = new Set<string>();
  const enqueue = (node: Node): void => {
    const s = node.state;
    if (wantAllShards && missedShard(world, s)) return;
    const q = Math.floor(s.x / Q);
    const key = `${q}|${surfaceKey(s)}|${shardMask(s)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const list = buckets.get(q);
    if (list) list.push(node);
    else buckets.set(q, [node]);
  };
  enqueue(startNode);

  let best: Node = startNode;
  let expanded = 0;
  const maxQ = Math.ceil(world.level.endX / Q) + 1;
  for (let q = Math.floor(world.level.startX / Q); q <= maxQ; q++) {
    const nodes = buckets.get(q);
    if (!nodes) continue;
    for (const node of nodes) {
      expanded++;
      if (node.state.x > best.state.x) best = node;
      const outcomes: HopOutcome[] = [hop(world, node.state, [], dt, maxHopSteps, Q)];
      for (const script of scripts) outcomes.push(hop(world, node.state, script, dt, maxHopSteps, 0));
      for (const o of outcomes) {
        if (o.kind === 'failed') continue;
        const child: Node = { state: o.state, parent: node, inputs: o.inputs };
        if (o.kind === 'finished') {
          if (!wantAllShards || o.state.shardCount >= shardTotal) {
            return { finished: true, best: o.state, plan: planOf(child), expanded };
          }
          continue;
        }
        enqueue(child);
      }
    }
    buckets.delete(q);
  }
  return { finished: false, best: best.state, plan: planOf(best), expanded };
}

/** Replays a plan from a fresh state; used to double check that a found plan really works. */
export function replayPlan(world: SimWorld, plan: boolean[], dt = SIM.fixedDt): { state: SimState; events: SimEvent[] } {
  const state = createSimState(world);
  const events: SimEvent[] = [];
  for (const held of plan) events.push(...stepSim(world, state, { held }, dt));
  return { state, events };
}

/** Runs the sim with a fixed input for a number of seconds. */
export function runFor(world: SimWorld, s: SimState, held: boolean, seconds: number, dt = SIM.fixedDt): SimEvent[] {
  const events: SimEvent[] = [];
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) events.push(...stepSim(world, s, { held }, dt));
  return events;
}

/** Runs with a fixed input until an event of the given type happens (true) or time runs out (false). */
export function runUntil(
  world: SimWorld,
  s: SimState,
  held: boolean,
  seconds: number,
  type: SimEvent['type'],
  dt = SIM.fixedDt,
): boolean {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) {
    if (stepSim(world, s, { held }, dt).some((e) => e.type === type)) return true;
  }
  return false;
}
