/**
 * Every tuning number for the game lives here.
 * Units are logical units (not pixels). Y is 0 at the ground line and negative upward.
 * Speeds are units per second, times are seconds.
 *
 * Age-track specific numbers (run speed, gravity, jump velocity) live in tracks.ts.
 */

/** Logical view and camera. */
export const VIEW = {
  /** The logical view is at least this big; wider or taller devices see more world. */
  minWidth: 520,
  minHeight: 330,
  /** The ground line sits this many units above the bottom edge of the view. */
  groundFromBottom: 64,
  /** The hero is kept this fraction of the view width from the left edge. */
  heroScreenX: 0.28,
} as const;

/** Hero collision body. Feet are at (x, y); the body extends upward. */
export const HERO_BODY = {
  width: 20,
  height: 36,
} as const;

/** Jump feel. Play-tested; keep these. */
export const JUMP = {
  /** Releasing early clamps upward velocity to this (variable jump height). */
  releaseClampVelocity: -220,
  /** You may still jump this long after running off an edge. */
  coyoteTime: 0.08,
  /** A press this long before landing still counts as a jump. */
  bufferTime: 0.12,
} as const;

/** Owen's air dash. */
export const DASH = {
  duration: 0.32,
  speedMultiplier: 2.3,
} as const;

/** Alice's float. */
export const FLOAT = {
  maxFallSpeed: 70,
  maxDuration: 1.3,
} as const;

/** Storm clouds (the common enemy). */
export const CLOUD = {
  width: 40,
  height: 26,
  /** Vertical bounce given to the hero when a cloud is popped from above (or touched on track 0). */
  stompBounce: -400,
  /** Bobbing clouds move up and down by this much. */
  bobAmplitude: 24,
  /** Seconds for one full bob cycle. */
  bobPeriod: 2.4,
  /** Feet may be this far below the cloud top and still count as a stomp. */
  stompTolerance: 8,
} as const;

/** Pickups. */
export const PICKUP = {
  radius: 24,
  /** Jackson pulls stars in for Owen. */
  owenRadius: 30,
  /** Stars picked up within this many seconds of each other continue a streak (pitch rises). */
  streakWindow: 1.0,
  maxStreak: 8,
} as const;

/** Pits. */
export const PIT = {
  /** Falling this far below the ground line counts as falling into the pit. */
  depth: 110,
  /** Track 0 only: the pit bounces the hero back up with this velocity. */
  bounceVelocity: -720,
} as const;

/** Respawn. */
export const RESPAWN = {
  /** After a respawn the hero blinks and cannot be hurt for this long. */
  safeTime: 1.2,
} as const;

/** Simulation stepping. */
export const SIM = {
  /** Fixed physics step. The renderer may run at any frame rate. */
  fixedDt: 1 / 120,
  /** Never simulate more than this many steps in one frame (tab switching etc). */
  maxStepsPerFrame: 12,
} as const;

/** Level geometry drawing helpers that the sim also relies on. */
export const WORLD = {
  /** Visual thickness of one-way platforms. */
  platformThickness: 12,
  /** How far below the ground line the drawn ground extends. */
  groundDepth: 200,
} as const;

/** Sidekick trail. */
export const SIDEKICK = {
  /** The sidekick follows where the hero was this many seconds ago. */
  delay: 0.3,
  /** Horizontal offset behind the hero. */
  behind: 34,
} as const;

/** Star layout generation (see level/stars.ts). */
export const STAR_LAYOUT = {
  lineHeight: -30,
  lineSpacing: 46,
  lineMargin: 60,
  /** No line stars this close to a gap edge (arcs cover the gap). */
  lineGapClearance: 140,
  /** No line stars this close to a cloud (arcs cover the cloud). */
  lineCloudClearance: 150,
  /** No line stars under a platform (rows sit above it). */
  linePlatformClearance: 40,
  gapArcHeights: [-52, -84, -96, -84, -52],
  gapArcOverhang: 25,
  cloudArcHeights: [0, -16, -22, -16, 0],
  cloudArcLift: -22,
  cloudArcSpacing: 32,
  platformRowLift: -36,
  platformRowInset: 25,
  platformRowCount: 3,
} as const;
