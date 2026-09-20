import type Phaser from 'phaser';
import { WORLD } from '../../game/config';
import type { Level } from '../../game/level/types';
import { PALETTE } from '../palette';

/** Static level geometry: ground, platforms and the checkpoint flags. */
export class LevelView {
  private readonly flags = new Map<number, Phaser.GameObjects.Graphics>();

  constructor(scene: Phaser.Scene, level: Level) {
    const g = scene.add.graphics().setDepth(10);
    // With a question stretch the level ends at the crystal, however many retries it takes: draw far past endX.
    const drawEnd = level.endX + (level.questionStartX === null ? 1200 : 20000);
    for (const seg of level.ground) {
      const x0 = seg.x0;
      const x1 = Math.min(seg.x1, drawEnd);
      g.fillStyle(PALETTE.dirt, 1);
      g.fillRect(x0, 0, x1 - x0, WORLD.groundDepth);
      g.fillStyle(PALETTE.dirtDark, 1);
      g.fillRect(x0, 40, x1 - x0, WORLD.groundDepth - 40);
      g.fillStyle(PALETTE.grass, 1);
      g.fillRoundedRect(x0, -6, x1 - x0, 20, 6);
      g.fillStyle(PALETTE.grassLight, 1);
      g.fillRoundedRect(x0 + 6, -6, Math.max(0, x1 - x0 - 12), 6, 3);
    }
    for (const p of level.platforms) {
      g.fillStyle(PALETTE.platformEdge, 1);
      g.fillRoundedRect(p.x0, p.y, p.x1 - p.x0, WORLD.platformThickness, 6);
      g.fillStyle(PALETTE.platform, 1);
      g.fillRoundedRect(p.x0, p.y - 2, p.x1 - p.x0, WORLD.platformThickness - 4, 6);
      g.fillStyle(PALETTE.grassLight, 1);
      g.fillRoundedRect(p.x0 + 4, p.y - 4, p.x1 - p.x0 - 8, 5, 2);
    }
    // Finish line, only for levels without a question stretch (those end at the star crystal).
    if (level.questionStartX === null) {
      g.fillStyle(PALETTE.text, 0.15);
      g.fillRect(level.endX - 3, -140, 6, 140);
    }

    for (const cp of level.checkpoints) {
      const flag = scene.add.graphics({ x: cp.x, y: 0 }).setDepth(11);
      this.flags.set(cp.id, flag);
      this.drawFlag(flag, false);
    }
  }

  private drawFlag(g: Phaser.GameObjects.Graphics, on: boolean): void {
    g.clear();
    g.fillStyle(PALETTE.checkpointPole, 1);
    g.fillRect(-3, -96, 6, 96);
    g.fillStyle(on ? PALETTE.checkpointOn : PALETTE.checkpointOff, 1);
    g.fillTriangle(3, -96, 3, -66, 40, -81);
    if (on) {
      g.fillStyle(PALETTE.star, 1);
      g.fillCircle(0, -100, 6);
    }
  }

  reachCheckpoint(id: number): void {
    const g = this.flags.get(id);
    if (g) this.drawFlag(g, true);
  }
}
