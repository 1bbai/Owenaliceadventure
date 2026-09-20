import type { RunOutcome } from '../../game/scoring';

export const SCENES = {
  title: 'TitleScene',
  players: 'PlayersScene',
  newPlayer: 'NewPlayerScene',
  grownUps: 'GrownUpsScene',
  game: 'GameScene',
  result: 'ResultScene',
} as const;

/** Data passed into the result scene. */
export interface ResultData extends RunOutcome {
  levelName: string;
  /** The profile that played, for the "in total" line. */
  nickname: string;
  totalStars: number;
  /** Best result stars on this level so far, including this run. */
  bestStars: number;
}

/** Data passed into the new-player scene. */
export interface NewPlayerData {
  /** First launch: there is no profile yet, so there is nothing to go back to. */
  first?: boolean;
}
