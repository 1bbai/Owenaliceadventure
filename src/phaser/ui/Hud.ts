import Phaser from 'phaser';
import { PALETTE } from '../palette';
import { getSfx, toggleSound } from '../sfx';
import { makeText } from './text';

/** Star count, shard count, sound toggle and menu button. Fixed to the screen. */
export class Hud {
  private readonly starText: Phaser.GameObjects.Text;
  private readonly shardText: Phaser.GameObjects.Text;
  private readonly soundIcon: Phaser.GameObjects.Graphics;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly shardIcons: Phaser.GameObjects.Polygon[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    shardsTotal: number,
    onMenu: () => void,
  ) {
    // Left cluster: stars and shards.
    this.left = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);
    const bg = scene.add.graphics();
    bg.fillStyle(PALETTE.panel, 0.8);
    bg.fillRoundedRect(0, 0, 212, 40, 14);
    const star = scene.add.star(24, 20, 5, 6, 12, PALETTE.star).setStrokeStyle(2, PALETTE.starEdge);
    this.starText = makeText(scene, 62, 20, '0', 'heading').setOrigin(0, 0.5);
    this.left.add([bg, star, this.starText]);
    for (let i = 0; i < shardsTotal; i++) {
      const p = scene.add
        .polygon(128 + i * 22, 20, [0, -9, 6, 0, 0, 9, -6, 0], PALETTE.shard)
        .setStrokeStyle(2, PALETTE.shardEdge)
        .setAlpha(0.3);
      this.shardIcons.push(p);
      this.left.add(p);
    }
    this.shardText = makeText(scene, 128 + shardsTotal * 22 + 2, 20, `0 / ${shardsTotal}`, 'small').setOrigin(0, 0.5);
    this.left.add(this.shardText);

    // Right cluster: sound toggle and menu.
    this.right = scene.add.container(0, 0).setScrollFactor(0).setDepth(100);
    const soundBg = scene.add.graphics();
    soundBg.fillStyle(PALETTE.panel, 0.8);
    soundBg.fillRoundedRect(0, 0, 48, 48, 14);
    this.soundIcon = scene.add.graphics();
    this.drawSound(getSfx().enabled);
    const soundZone = scene.add
      .zone(24, 24, 56, 56)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => this.drawSound(toggleSound()));
    const menuBg = scene.add.graphics();
    menuBg.fillStyle(PALETTE.panel, 0.8);
    menuBg.fillRoundedRect(58, 0, 84, 48, 14);
    const menuText = makeText(scene, 100, 24, 'Menu', 'body');
    const menuZone = scene.add
      .zone(100, 24, 92, 56)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => {
        getSfx().play('tap');
        onMenu();
      });
    this.right.add([soundBg, this.soundIcon, soundZone, menuBg, menuText, menuZone]);
    this.layout();
  }

  private drawSound(on: boolean): void {
    const g = this.soundIcon;
    g.clear();
    g.fillStyle(PALETTE.text, 1);
    g.fillTriangle(12, 24, 26, 12, 26, 36);
    g.fillRect(10, 19, 6, 10);
    if (on) {
      g.lineStyle(3, PALETTE.text, 1);
      g.beginPath();
      g.arc(28, 24, 7, -Math.PI / 3, Math.PI / 3, false);
      g.strokePath();
      g.beginPath();
      g.arc(28, 24, 12, -Math.PI / 3, Math.PI / 3, false);
      g.strokePath();
    } else {
      g.lineStyle(3, PALETTE.checkpointOn, 1);
      g.lineBetween(30, 18, 40, 30);
      g.lineBetween(40, 18, 30, 30);
    }
  }

  layout(): void {
    this.left.setPosition(10, 10);
    this.right.setPosition(this.scene.scale.width - 152, 10);
  }

  setStars(n: number): void {
    this.starText.setText(String(n));
    this.scene.tweens.add({ targets: this.starText, scaleX: 1.3, scaleY: 1.3, duration: 90, yoyo: true });
  }

  setShards(found: number, total: number): void {
    this.shardText.setText(`${found} / ${total}`);
    this.shardIcons.forEach((p, i) => p.setAlpha(i < found ? 1 : 0.3));
  }
}
