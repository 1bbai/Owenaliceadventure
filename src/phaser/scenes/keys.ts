import type { RunOutcome } from '../../game/scoring';

export const SCENES = {
  title: 'TitleScene',
  game: 'GameScene',
  result: 'ResultScene',
} as const;

/** Data passed into the result scene. */
export interface ResultData extends RunOutcome {
  levelName: string;
}
