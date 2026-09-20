import Phaser from 'phaser';
import { PALETTE } from '../palette';
import { getSfx, toggleSound } from '../sfx';
import { isSpeechOn, toggleSpeech } from '../speech';
import { makeText } from './text';

const RIGHT_WIDTH = 200;

/** Star count, shard count, sound and read-aloud toggles, and the menu button. Fixed to the screen. */
export class Hud {
  private readonly starText: Phaser.GameObjects.Text;
  private readonly shardText: Phaser.GameObjects.Text;
  private readonly soundIcon: Phaser.GameObjects.Graphics;
  private readonly speechIcon: Phaser.GameObjects.Graphics;
  private readonly left: Phaser.GameObjects.Container;
  private readonly right: Phaser.GameObjects.Container;
  private readonly shardIcons: Phaser.GameObjects.Polygon[] = [];
  /** Height of the question banner while it is up; the counters hide and the buttons drop below it. */
  private bannerHeight = 0;

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

    // Right cluster: sound toggle, read-aloud toggle and menu.
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
    const speechBg = scene.add.graphics();
    speechBg.fillStyle(PALETTE.panel, 0.8);
    speechBg.fillRoundedRect(58, 0, 48, 48, 14);
    this.speechIcon = scene.add.graphics({ x: 58, y: 0 });
    this.drawSpeech(isSpeechOn());
    const speechZone = scene.add
      .zone(82, 24, 56, 56)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => {
        getSfx().play('tap');
        this.drawSpeech(toggleSpeech());
      });
    const menuBg = scene.add.graphics();
    menuBg.fillStyle(PALETTE.panel, 0.8);
    menuBg.fillRoundedRect(116, 0, 84, 48, 14);
    const menuText = makeText(scene, 158, 24, 'Menu', 'body');
    const menuZone = scene.add
      .zone(158, 24, 92, 56)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => {
        getSfx().play('tap');
        onMenu();
      });
    this.right.add([soundBg, this.soundIcon, soundZone, speechBg, this.speechIcon, speechZone, menuBg, menuText, menuZone]);
    this.layout();
  }

  /** A speech bubble with "Aa" inside; crossed out when reading aloud is off. */
  private drawSpeech(on: boolean): void {
    const g = this.speechIcon;
    g.clear();
    g.lineStyle(3, PALETTE.text, 1);
    g.strokeRoundedRect(10, 11, 28, 20, 7);
    g.fillStyle(PALETTE.text, 1);
    g.fillTriangle(16, 30, 24, 30, 15, 38);
    g.fillStyle(PALETTE.panel, 1);
    g.fillRect(17, 28, 6, 4);
    g.fillStyle(PALETTE.text, 1);
    g.fillCircle(19, 21, 2.2);
    g.fillCircle(25, 21, 2.2);
    g.fillCircle(31, 21, 2.2);
    if (!on) {
      g.lineStyle(3, PALETTE.checkpointOn, 1);
      g.lineBetween(9, 39, 39, 9);
    }
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
    const top = this.bannerHeight > 0 ? this.bannerHeight + 6 : 10;
    this.left.setPosition(10, 10).setVisible(this.bannerHeight === 0);
    this.right.setPosition(this.scene.scale.width - RIGHT_WIDTH - 10, top);
  }

  /** While the question banner is up (height > 0) the counters hide and the buttons sit below it. */
  setBannerHeight(height: number): void {
    if (height === this.bannerHeight) return;
    this.bannerHeight = height;
    this.layout();
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
