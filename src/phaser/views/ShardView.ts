import type Phaser from 'phaser';
import type { Shard } from '../../game/level/types';
import { PALETTE } from '../palette';

/** Hidden crystal shards: pale blue diamonds with a slow sparkle. */
export class ShardField {
  private readonly shapes = new Map<number, Phaser.GameObjects.Polygon>();

  constructor(private readonly scene: Phaser.Scene, shards: Shard[]) {
    for (const s of shards) {
      const shape = scene.add.polygon(s.x, s.y, [0, -16, 11, 0, 0, 16, -11, 0], PALETTE.shard).setDepth(21);
      shape.setStrokeStyle(2, PALETTE.shardEdge, 1);
      scene.tweens.add({
        targets: shape,
        scaleX: 0.7,
        y: s.y - 6,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.shapes.set(s.id, shape);
    }
  }

  collect(id: number): void {
    const shape = this.shapes.get(id);
    if (!shape) return;
    this.shapes.delete(id);
    this.scene.tweens.killTweensOf(shape);
    this.scene.tweens.add({
      targets: shape,
      scaleX: 2.5,
      scaleY: 2.5,
      angle: 180,
      alpha: 0,
      duration: 380,
      ease: 'Back.easeIn',
      onComplete: () => shape.destroy(),
    });
  }
}
