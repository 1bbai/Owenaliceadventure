/** Result-screen scoring: three stars and the line for grown-ups. */
export interface RunOutcome {
  finished: boolean;
  shardsFound: number;
  shardsTotal: number;
  starsCollected: number;
  starsTotal: number;
  /** All locks on the star gate opened (the question stretch was completed). */
  gateOpened: boolean;
  questionsAsked: number;
  rightFirstTime: number;
  /** Times the same question came round again with a clue. */
  cluesUsed: number;
  /** Returns to a checkpoint (pits and cloud bumps on tracks 1 and 2). */
  respawns: number;
  /** Skill names practised, in the order they came up. */
  skills: string[];
}

export interface ResultStars {
  finished: boolean;
  allShards: boolean;
  /** Opened the gate without ever needing a clue. */
  third: boolean;
  /** The label shown under the third star. */
  thirdLabel: string;
}

export const THIRD_STAR_LABEL = 'Opened the gate without a clue';

export function resultStars(o: RunOutcome): ResultStars {
  return {
    finished: o.finished,
    allShards: o.shardsTotal > 0 && o.shardsFound >= o.shardsTotal,
    third: o.gateOpened && o.cluesUsed === 0,
    thirdLabel: THIRD_STAR_LABEL,
  };
}

export function countEarned(r: ResultStars): number {
  return [r.finished, r.allShards, r.third].filter(Boolean).length;
}

/** Joins names as "a", "a and b" or "a, b and c". */
export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return 'none yet';
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The "For grown-ups" line on the result screen. */
export function grownUpsLine(o: RunOutcome): string {
  return (
    `For grown-ups: skills practised: ${joinNames(o.skills)}. ` +
    `Right first time ${o.rightFirstTime} of ${o.questionsAsked}. ` +
    `Clues used ${o.cluesUsed}. Retries from a checkpoint ${o.respawns}.`
  );
}
