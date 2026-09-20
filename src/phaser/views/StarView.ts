import type Phaser from 'phaser';
import type { Star } from '../../game/level/types';
import { PALETTE } from '../palette';

/** All collectible stars in a level. Each is a small twinkling shape until picked up. */
export class StarField {
  private readonly shapes = new Map<number, Phaser.GameObjects.Star>();

  constructor(private readonly scene: Phaser.Scene, stars: Star[]) {
    for (const s of stars) {
      const shape = scene.add.star(s.x, s.y, 5, 5, 11, PALETTE.star).setDepth(20);
      shape.setStrokeStyle(2, PALETTE.starEdge, 1);
      scene.tweens.add({
        targets: shape,
        scaleX: 0.8,
        scaleY: 0.8,
        angle: 12,
        duration: 700 + ((s.id * 37) % 400),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: (s.id * 53) % 700,
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
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      y: shape.y - 30,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => shape.destroy(),
    });
  }
}
