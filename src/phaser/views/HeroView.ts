import Phaser from 'phaser';
import { HERO_BODY } from '../../game/config';
import type { HeroDef } from '../../game/heroes';
import type { SimState } from '../../game/sim/heroSim';
import { PALETTE } from '../palette';

/**
 * Placeholder hero drawn from shapes. The container's origin is at the feet,
 * matching the sim's (x, y). Swap the drawing in `build()` for sprites later;
 * `sync()` is the only thing the scene calls.
 */
export class HeroView extends Phaser.GameObjects.Container {
  private readonly figure: Phaser.GameObjects.Container;
  private readonly legL: Phaser.GameObjects.Graphics;
  private readonly legR: Phaser.GameObjects.Graphics;
  private readonly extra: Phaser.GameObjects.Graphics;
  private runPhase = 0;
  private wasGrounded = true;
  private squash: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, readonly hero: HeroDef) {
    super(scene, 0, 0);
    this.figure = scene.add.container(0, 0);
    this.legL = scene.add.graphics();
    this.legR = scene.add.graphics();
    this.extra = scene.add.graphics();
    this.build();
    this.add(this.figure);
    this.setDepth(50);
    scene.add.existing(this);
  }

  private build(): void {
    const h = HERO_BODY.height;
    const w = HERO_BODY.width;
    const g = this.scene.add.graphics();
    const isOwen = this.hero.id === 'owen';
    const skin = isOwen ? PALETTE.owenSkin : PALETTE.aliceSkin;

    // Legs (drawn separately so they can swing).
    for (const leg of [this.legL, this.legR]) {
      leg.fillStyle(isOwen ? PALETTE.owenJacketDark : PALETTE.alicePurple, 1);
      leg.fillRoundedRect(-3, 0, 6, 12, 3);
      leg.fillStyle(PALETTE.text, 1);
      leg.fillRoundedRect(-4, 10, 9, 4, 2);
    }
    this.legL.setPosition(-5, -13);
    this.legR.setPosition(5, -13);

    if (isOwen) {
      // Blue pilot jacket.
      g.fillStyle(PALETTE.owenJacket, 1);
      g.fillRoundedRect(-w / 2, -h + 10, w, 20, 6);
      g.fillStyle(PALETTE.owenJacketDark, 1);
      g.fillRect(-2, -h + 12, 4, 16);
      // Head and hair.
      g.fillStyle(skin, 1);
      g.fillCircle(0, -h + 2, 9);
      g.fillStyle(PALETTE.owenHair, 1);
      g.fillEllipse(0, -h - 4, 18, 8);
      // Aviator goggles.
      g.fillStyle(PALETTE.goggles, 1);
      g.fillRoundedRect(-9, -h - 2, 18, 5, 2);
      g.fillStyle(PALETTE.gogglesGlass, 1);
      g.fillCircle(-4, -h, 3);
      g.fillCircle(4, -h, 3);
    } else {
      // Pink and purple princess dress.
      g.fillStyle(PALETTE.alicePurple, 1);
      g.fillTriangle(-w / 2 - 4, -8, w / 2 + 4, -8, 0, -h + 12);
      g.fillStyle(PALETTE.aliceDress, 1);
      g.fillTriangle(-w / 2, -10, w / 2, -10, 0, -h + 12);
      g.fillRoundedRect(-6, -h + 10, 12, 10, 3);
      // Head and hair.
      g.fillStyle(PALETTE.aliceHair, 1);
      g.fillEllipse(0, -h + 4, 22, 20);
      g.fillStyle(skin, 1);
      g.fillCircle(0, -h + 2, 8);
      // Tiara.
      g.fillStyle(PALETTE.tiara, 1);
      g.fillTriangle(-6, -h - 5, 6, -h - 5, 0, -h - 13);
      g.fillCircle(0, -h - 12, 2);
      // Star wand in the front hand.
      g.lineStyle(2, PALETTE.wand, 1);
      g.lineBetween(9, -h + 18, 15, -h + 2);
      g.fillStyle(PALETTE.star, 1);
      g.fillCircle(15, -h, 3.5);
    }
    // Face.
    g.fillStyle(PALETTE.text, 1);
    g.fillCircle(3, -h + 1, 1.3);
    g.fillCircle(7, -h + 1, 1.3);

    this.figure.add([this.legL, this.legR, g, this.extra]);
  }

  /** Squash and stretch on takeoff and landing. */
  private pulse(scaleX: number, scaleY: number): void {
    this.squash?.stop();
    this.figure.setScale(scaleX, scaleY);
    this.squash = this.scene.tweens.add({
      targets: this.figure,
      scaleX: 1,
      scaleY: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  onJump(): void {
    this.pulse(0.78, 1.25);
  }

  onLand(): void {
    this.pulse(1.25, 0.72);
  }

  /** Mirrors the sim every frame. */
  sync(s: SimState, runSpeed: number, dt: number): void {
    this.setPosition(s.x, s.y);
    const dashing = s.dashTimer > 0;

    if (s.grounded) {
      this.runPhase += dt * runSpeed * 0.11;
      const swing = Math.sin(this.runPhase) * 7;
      this.legL.setPosition(-5 + swing, -13 - Math.max(0, -swing) * 0.4);
      this.legR.setPosition(5 - swing, -13 - Math.max(0, swing) * 0.4);
      this.figure.rotation = 0;
    } else {
      this.legL.setPosition(-6, -12);
      this.legR.setPosition(6, -13);
      this.figure.rotation = dashing ? 0.35 : Phaser.Math.Clamp(s.vy / 1600, -0.18, 0.18);
    }
    if (s.floating) this.figure.rotation = Math.sin(s.t * 6) * 0.08;

    // Blink while safe after a respawn.
    this.figure.setAlpha(s.safeTimer > 0 ? (Math.floor(s.t * 12) % 2 === 0 ? 0.35 : 1) : 1);

    // Air-ability accents.
    this.extra.clear();
    if (dashing) {
      this.extra.fillStyle(PALETTE.textLight, 0.7);
      this.extra.fillEllipse(-20, -HERO_BODY.height / 2, 24, 6);
      this.extra.fillEllipse(-30, -HERO_BODY.height / 2 + 8, 16, 4);
    } else if (s.floating) {
      this.extra.fillStyle(PALETTE.aliceDress, 0.9);
      this.extra.fillEllipse(0, -HERO_BODY.height - 20, 30, 10);
      this.extra.lineStyle(1.5, PALETTE.alicePurple, 0.8);
      this.extra.lineBetween(-12, -HERO_BODY.height - 18, -4, -HERO_BODY.height + 8);
      this.extra.lineBetween(12, -HERO_BODY.height - 18, 4, -HERO_BODY.height + 8);
    }
    this.wasGrounded = s.grounded;
  }
}
