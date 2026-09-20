import { generateStars } from './stars';
import type { Level, LevelJson } from './types';

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`Invalid level: ${message}`);
}

/** Validates raw level JSON and turns it into a typed Level with generated stars. */
export function loadLevel(json: LevelJson): Level {
  assert(typeof json.id === 'string' && json.id.length > 0, 'missing id');
  assert(Array.isArray(json.ground) && json.ground.length > 0, 'needs ground');
  assert(json.endX > json.startX, 'endX must be after startX');

  const ground = json.ground
    .map(([x0, x1]) => {
      assert(x1 > x0, `ground segment [${x0}, ${x1}] is reversed`);
      return { x0, x1 };
    })
    .sort((a, b) => a.x0 - b.x0);
  for (let i = 0; i + 1 < ground.length; i++) {
    assert(ground[i + 1]!.x0 > ground[i]!.x1, `ground segments ${i} and ${i + 1} overlap`);
  }

  const platforms = json.platforms.map(([x0, x1, y], id) => {
    assert(x1 > x0 && y < 0, `platform ${id} must be above ground with x1 > x0`);
    return { id, x0, x1, y };
  });

  const checkpoints = [...json.checkpoints]
    .sort((a, b) => a - b)
    .map((x, id) => {
      assert(
        ground.some((s) => x >= s.x0 && x <= s.x1),
        `checkpoint at ${x} is not on the ground`,
      );
      return { id, x };
    });
  assert(checkpoints.length > 0, 'needs at least one checkpoint');

  const shards = json.shards.map(([x, y], id) => ({ id, x, y }));
  const clouds = json.clouds.map(([x, y, bobs], id) => ({ id, x, y, bobs: Boolean(bobs) }));
  const tips = [...json.tips].sort((a, b) => a.untilX - b.untilX);

  const base: Omit<Level, 'stars'> = {
    id: json.id,
    name: json.name,
    world: json.world,
    index: json.index,
    startX: json.startX,
    endX: json.endX,
    questionStartX: json.questionStartX,
    ground,
    platforms,
    checkpoints,
    shards,
    clouds,
    tips,
  };
  return { ...base, stars: generateStars(base) };
}

/** Returns the tip to show at hero x, with hero placeholders filled in. */
export function tipAt(level: Level, x: number, airTip: string): string | null {
  const tip = level.tips.find((t) => x < t.untilX);
  return tip ? tip.text.replace('{airTip}', airTip) : null;
}
