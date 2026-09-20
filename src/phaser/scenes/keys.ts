export const SCENES = {
  title: 'TitleScene',
  game: 'GameScene',
  result: 'ResultScene',
} as const;

/** Data passed into the result scene. */
export interface ResultData {
  levelName: string;
  finished: boolean;
  shardsFound: number;
  shardsTotal: number;
  starsCollected: number;
  starsTotal: number;
}
