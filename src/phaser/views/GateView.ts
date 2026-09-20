import type Phaser from 'phaser';
import { QUESTIONS } from '../../game/config';
import { PALETTE } from '../palette';
import { sparkle } from './Burst';

/** The star gate whose bars lift once all locks are open, and the star crystal beyond it. */
export class GateView {
  private bars: Phaser.GameObjects.Graphics | null = null;
  private crystal: Phaser.GameObjects.Container | null = null;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Draws the gate ahead with its bars down, then lifts them over QUESTIONS.gateLiftSeconds. */
  place(gateX: number, crystalX: number): void {
    const s = this.scene;
    const frame = s.add.graphics({ x: gateX, y: 0 }).setDepth(12);
    frame.fillStyle(PALETTE.checkpointPole, 1);
    frame.fillRoundedRect(-34, -126, 12, 126, 4);
    frame.fillRoundedRect(22, -126, 12, 126, 4);
    frame.fillStyle(PALETTE.platformEdge, 1);
    frame.fillRoundedRect(-40, -134, 80, 14, 6);
    frame.fillStyle(PALETTE.star, 1);
    frame.fillCircle(0, -127, 5);

    // Bars sit in front of the frame and lift up out of the way.
    this.bars = s.add.graphics({ x: gateX, y: 0 }).setDepth(13);
    this.bars.fillStyle(PALETTE.cloudDark, 1);
    for (const y of [-100, -72, -44, -16]) this.bars.fillRoundedRect(-26, y, 52, 8, 4);
    for (const x of [-12, 0, 12]) this.bars.fillRoundedRect(x - 3, -108, 6, 100, 3);
    s.tweens.add({
      targets: this.bars,
      y: -110,
      alpha: 0,
      duration: QUESTIONS.gateLiftSeconds * 1000,
      ease: 'Sine.easeInOut',
      onComplete: () => this.bars?.destroy(),
    });
    sparkle(s, gateX, -127, 8);

    // The star crystal: reaching it finishes the level.
    const c = s.add.container(crystalX, -64).setDepth(31);
    const glow = s.add.circle(0, 0, 34, PALETTE.star, 0.22);
    const star = s.add.star(0, 0, 5, 13, 28, PALETTE.shard).setStrokeStyle(3, PALETTE.shardEdge);
    const spark = s.add.star(0, 0, 5, 5, 11, PALETTE.textLight, 0.9);
    c.add([glow, star, spark]);
    s.tweens.add({ targets: c, y: -74, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    s.tweens.add({ targets: glow, scaleX: 1.25, scaleY: 1.25, duration: 700, yoyo: true, repeat: -1 });
    s.tweens.add({ targets: star, angle: 360, duration: 6000, repeat: -1 });
    this.crystal = c;
  }

  /** The hero reached the crystal. */
  collect(): void {
    const c = this.crystal;
    if (!c) return;
    this.crystal = null;
    this.scene.tweens.killTweensOf(c);
    sparkle(this.scene, c.x, c.y, 14);
    this.scene.tweens.add({ targets: c, scaleX: 2.2, scaleY: 2.2, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
  }
}
