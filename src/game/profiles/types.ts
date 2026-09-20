import type { HeroId } from '../heroes';
import type { TrackId } from '../tracks';

/** One answered question in the learning log. */
export interface LearningEntry {
  /** Skill name from the question generator, for example "Adding within 10". */
  skill: string;
  /** Right on the first try. */
  firstTry: boolean;
  /** How many times the question came round again with a clue before it was answered (0 = no clue). */
  clues: number;
  /** ISO date-time string. */
  at: string;
}

/** Time spent in a level, recorded when the level ends or the game goes to the background. */
export interface PlayEntry {
  seconds: number;
  /** ISO date-time string. */
  at: string;
}

export interface LevelProgress {
  /** Best result stars (0 to 3) on this level. */
  bestStars: number;
  /** Most stars collected in one run of this level. */
  bestCollected: number;
  /** Shard ids ever found on this level (never lost). */
  shards: number[];
}

export interface Progress {
  /** Keyed by level id, for example "w1l1". */
  levels: Record<string, LevelProgress>;
  /** Every star collected in every run, added up. */
  totalStars: number;
  /** Rolling log of question results, oldest first. */
  questions: LearningEntry[];
  /** Rolling log of play time, oldest first. */
  play: PlayEntry[];
}

export interface Profile {
  id: string;
  nickname: string;
  /** The age band, which sets the track. */
  track: TrackId;
  /** Favourite hero, pre-selected on the title screen. */
  hero: HeroId;
  /** ISO date-time string. */
  createdAt: string;
  progress: Progress;
}

/** Everything the storage module keeps, as one JSON document. */
export interface ProfilesData {
  version: 1;
  activeId: string | null;
  profiles: Profile[];
}

/** What a finished level reports to the profile. */
export interface RunRecord {
  levelId: string;
  /** Result stars earned, 0 to 3. */
  stars: number;
  starsCollected: number;
  /** Ids of the shards found in this run. */
  shardIds: number[];
}
