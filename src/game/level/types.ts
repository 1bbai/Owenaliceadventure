/**
 * Level data format. Levels are JSON files under src/data/levels; this module
 * describes the raw JSON shape and the parsed, typed Level used by the game.
 */

/** Raw JSON shape, kept compact so levels are easy to hand-edit. */
export interface LevelJson {
  id: string;
  name: string;
  world: number;
  index: number;
  /** Where the hero starts (feet on the ground). */
  startX: number;
  /**
   * Crossing this x finishes a level that has no question stretch. With one,
   * the level finishes at the star crystal placed after the gate instead, and
   * the ground must carry on well past endX.
   */
  endX: number;
  /** Where the question stretch begins, on flat ground. Star lines stop here. Omit for no questions. */
  questionStartX?: number;
  /** Ground segments [x0, x1]. Anything not covered is a pit. */
  ground: [number, number][];
  /** One-way floating platforms [x0, x1, y]. */
  platforms: [number, number, number][];
  /** Checkpoint x positions (must be on ground). */
  checkpoints: number[];
  /** Hidden crystal shards [x, y]. */
  shards: [number, number][];
  /** Storm clouds [x, y, bobs]. */
  clouds: [number, number, boolean][];
  /** Tips shown at the bottom while hero.x < untilX. "{airTip}" is replaced by the hero's air-ability tip. */
  tips: { untilX: number; text: string }[];
}

export interface GroundSegment {
  x0: number;
  x1: number;
}

export interface Platform {
  id: number;
  x0: number;
  x1: number;
  y: number;
}

export interface Checkpoint {
  id: number;
  x: number;
}

export interface Shard {
  id: number;
  x: number;
  y: number;
}

export interface Cloud {
  id: number;
  x: number;
  /** Centre y at rest. */
  y: number;
  bobs: boolean;
}

export interface Star {
  id: number;
  x: number;
  y: number;
  kind: 'line' | 'gapArc' | 'cloudArc' | 'platformRow';
}

export interface Tip {
  untilX: number;
  text: string;
}

export interface Level {
  id: string;
  name: string;
  world: number;
  index: number;
  startX: number;
  endX: number;
  /** null when the level has no question stretch. */
  questionStartX: number | null;
  ground: GroundSegment[];
  platforms: Platform[];
  checkpoints: Checkpoint[];
  shards: Shard[];
  clouds: Cloud[];
  stars: Star[];
  tips: Tip[];
}
