/** Result-screen scoring. The third star is reserved for the question stretch (prompt 2). */
export interface RunOutcome {
  finished: boolean;
  shardsFound: number;
  shardsTotal: number;
  starsCollected: number;
  starsTotal: number;
}

export interface ResultStars {
  finished: boolean;
  allShards: boolean;
  /** Reserved for prompt 2 (questions). Always false for now. */
  third: boolean;
  /** The label shown under the reserved star. */
  thirdLabel: string;
}

export function resultStars(o: RunOutcome): ResultStars {
  return {
    finished: o.finished,
    allShards: o.shardsTotal > 0 && o.shardsFound >= o.shardsTotal,
    third: false,
    thirdLabel: 'Coming soon',
  };
}

export function countEarned(r: ResultStars): number {
  return [r.finished, r.allShards, r.third].filter(Boolean).length;
}
