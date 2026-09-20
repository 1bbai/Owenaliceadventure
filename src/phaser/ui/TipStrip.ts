import type Phaser from 'phaser';
import { PALETTE } from '../palette';
import { makeText } from './text';

/** A small strip at the bottom of the screen with a one-line tip. */
export class TipStrip {
  private readonly container: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly text: Phaser.GameObjects.Text;
  private current: string | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);
    this.bg = scene.add.graphics();
    this.text = makeText(scene, 0, 0, '', 'body', PALETTE.textLight);
    this.container.add([this.bg, this.text]);
    this.container.setAlpha(0);
    this.layout();
  }

  layout(): void {
    this.container.setPosition(this.scene.scale.width / 2, this.scene.scale.height - 30);
  }

  show(tip: string | null): void {
    if (tip === this.current) return;
    this.current = tip;
    this.scene.tweens.killTweensOf(this.container);
    if (!tip) {
      this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 250 });
      return;
    }
    this.text.setText(tip);
    const w = this.text.width + 36;
    this.bg.clear();
    this.bg.fillStyle(PALETTE.text, 0.72);
    this.bg.fillRoundedRect(-w / 2, -20, w, 40, 14);
    this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 250 });
  }
}
