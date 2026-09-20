import w1l1 from '../data/levels/w1l1.json';
import { loadLevel } from './level/loadLevel';
import type { Level, LevelJson } from './level/types';

/** All shipped levels, in play order. */
export const LEVEL_JSON: readonly LevelJson[] = [w1l1 as LevelJson];

export function loadAllLevels(): Level[] {
  return LEVEL_JSON.map(loadLevel);
}

export function loadFirstLevel(): Level {
  return loadLevel(LEVEL_JSON[0]!);
}
