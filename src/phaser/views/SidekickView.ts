import Phaser from 'phaser';
import { SIDEKICK } from '../../game/config';
import type { HeroDef } from '../../game/heroes';
import { PALETTE } from '../palette';

interface TrailPoint {
  t: number;
  x: number;
  y: number;
}

/**
 * The sidekick follows a short delayed trail behind the hero.
 * Aliceson (baby unicorn) hovers; Jackson (living race car) bounces along.
 */
export class SidekickView extends Phaser.GameObjects.Container {
  private readonly trail: TrailPoint[] = [];
  private readonly kind: HeroDef['sidekickKind'];
  private readonly art: Phaser.GameObjects.Graphics;
  private wobble = 0;

  constructor(scene: Phaser.Scene, hero: HeroDef) {
    super(scene, 0, 0);
    this.kind = hero.sidekickKind;
    this.art = scene.add.graphics();
    this.add(this.art);
    if (this.kind === 'car') this.drawJackson();
    else this.drawAliceson();
    this.setDepth(45);
    scene.add.existing(this);
  }

  private drawJackson(): void {
    const g = this.art;
    g.fillStyle(PALETTE.jacksonDark, 1);
    g.fillRoundedRect(-12, -10, 24, 8, 3);
    g.fillStyle(PALETTE.jackson, 1);
    g.fillRoundedRect(-13, -13, 26, 9, 4);
    g.fillRoundedRect(-6, -19, 12, 8, 3);
    g.fillStyle(PALETTE.gogglesGlass, 1);
    g.fillRoundedRect(0, -18, 5, 5, 1);
    g.fillStyle(PALETTE.wheel, 1);
    g.fillCircle(-8, -3, 4);
    g.fillCircle(8, -3, 4);
    // Puppy eyes on the bonnet.
    g.fillStyle(PALETTE.textLight, 1);
    g.fillCircle(9, -10, 2.4);
    g.fillStyle(PALETTE.text, 1);
    g.fillCircle(9.8, -10, 1.2);
  }

  private drawAliceson(): void {
    const g = this.art;
    g.fillStyle(PALETTE.unicorn, 1);
    g.fillEllipse(0, -10, 22, 16);
    g.fillCircle(9, -18, 7);
    g.fillStyle(PALETTE.unicornMane, 1);
    g.fillCircle(4, -24, 4);
    g.fillCircle(0, -21, 3.5);
    g.fillEllipse(-12, -10, 8, 10);
    g.fillStyle(PALETTE.unicornHorn, 1);
    g.fillTriangle(9, -24, 13, -24, 11, -33);
    g.fillStyle(PALETTE.unicorn, 1);
    for (const lx of [-6, -2, 4, 8]) g.fillRoundedRect(lx, -4, 4, 6, 2);
    g.fillStyle(PALETTE.text, 1);
    g.fillCircle(12, -19, 1.3);
    g.fillStyle(PALETTE.unicornMane, 0.7);
    g.fillCircle(13, -15, 1.6);
  }

  /** Records where the hero is; the sidekick chases where they were `SIDEKICK.delay` seconds ago. */
  sync(t: number, heroX: number, heroY: number, heroGrounded: boolean, dt: number): void {
    this.trail.push({ t, x: heroX, y: heroY });
    while (this.trail.length > 2 && this.trail[0]!.t < t - SIDEKICK.delay - 0.1) this.trail.shift();
    const target = this.trail.find((p) => p.t >= t - SIDEKICK.delay) ?? this.trail[this.trail.length - 1]!;
    const tx = target.x - SIDEKICK.behind;
    this.wobble += dt;
    let ty: number;
    if (this.kind === 'unicorn') {
      ty = target.y - 26 + Math.sin(this.wobble * 4) * 5;
    } else {
      const hop = Math.abs(Math.sin(this.wobble * 9)) * 9;
      ty = (heroGrounded ? Math.max(target.y, heroY) : target.y) - hop;
    }
    // Ease toward the target so the motion stays soft.
    const k = Math.min(1, dt * 12);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    if (Math.abs(tx - this.x) > 200) this.setPosition(tx, ty);
  }

  /** Snap after a respawn so the sidekick does not fly across the level. */
  teleport(x: number, y: number): void {
    this.trail.length = 0;
    this.setPosition(x - SIDEKICK.behind, y);
  }
}
