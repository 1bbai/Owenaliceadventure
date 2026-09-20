import type Phaser from 'phaser';
import { QUESTIONS } from '../../game/config';
import type { Bubble } from '../../game/sim/learning';
import { PALETTE } from '../palette';
import { makeText } from '../ui/text';
import { sparkle } from './Burst';

/** The three answer bubbles floating ahead of the hero at jump height. */
export class BubbleField {
  private readonly bubbles = new Map<number, Phaser.GameObjects.Container>();

  constructor(private readonly scene: Phaser.Scene) {}

  /** Replaces any bubbles still around with a new row. */
  spawn(bubbles: Bubble[]): void {
    this.vanish();
    for (const b of bubbles) {
      const c = this.scene.add.container(b.x, b.y).setDepth(30);
      const shadow = this.scene.add.circle(0, 4, QUESTIONS.bubbleRadius, PALETTE.panelShadow, 0.25);
      const body = this.scene.add.circle(0, 0, QUESTIONS.bubbleRadius, PALETTE.panel, 0.96).setStrokeStyle(3, PALETTE.skyHigh);
      const shine = this.scene.add.circle(-7, -8, 4, PALETTE.textLight, 0.9);
      const label = makeText(this.scene, 0, 1, String(b.value), 'heading');
      c.add([shadow, body, shine, label]);
      c.setScale(0);
      this.scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.easeOut' });
      this.scene.tweens.add({
        targets: c,
        y: b.y - 5,
        duration: 900 + b.id * 120,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 300,
      });
      this.bubbles.set(b.id, c);
    }
  }

  /** The hero jumped into a bubble. */
  grab(id: number, correct: boolean): void {
    const c = this.bubbles.get(id);
    if (!c) return;
    this.bubbles.delete(id);
    this.scene.tweens.killTweensOf(c);
    if (correct) {
      sparkle(this.scene, c.x, c.y, 10);
      this.scene.tweens.add({
        targets: c,
        scaleX: 1.6,
        scaleY: 1.6,
        alpha: 0,
        y: c.y - 30,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => c.destroy(),
      });
      this.vanish();
    } else {
      // A friendly wobble, then it drifts away. Nothing is lost.
      this.scene.tweens.add({ targets: c, angle: 12, duration: 70, yoyo: true, repeat: 2 });
      this.scene.tweens.add({
        targets: c,
        alpha: 0,
        y: c.y - 20,
        duration: 380,
        delay: 180,
        onComplete: () => c.destroy(),
      });
    }
  }

  /** Remaining bubbles shrink away. */
  vanish(): void {
    for (const c of this.bubbles.values()) {
      this.scene.tweens.killTweensOf(c);
      this.scene.tweens.add({ targets: c, scaleX: 0, scaleY: 0, alpha: 0, duration: 200, onComplete: () => c.destroy() });
    }
    this.bubbles.clear();
  }
}
