import type Phaser from 'phaser';
import { groundScreenY } from '../../game/viewport';
import { PALETTE } from '../palette';

const TILE_W = 512;
const FAR_H = 140;
const NEAR_H = 90;

/**
 * Sky, sun and two layers of rolling hills. Hills are generated once into
 * textures and shown as TileSprites that scroll at different speeds.
 */
export class Parallax {
  private readonly sky: Phaser.GameObjects.Rectangle;
  private readonly skyHigh: Phaser.GameObjects.Rectangle;
  private readonly sun: Phaser.GameObjects.Arc;
  private readonly far: Phaser.GameObjects.TileSprite;
  private readonly near: Phaser.GameObjects.TileSprite;

  constructor(private readonly scene: Phaser.Scene) {
    Parallax.ensureTextures(scene);
    this.skyHigh = scene.add.rectangle(0, 0, 10, 10, PALETTE.skyHigh).setOrigin(0).setScrollFactor(0).setDepth(-100);
    this.sky = scene.add.rectangle(0, 0, 10, 10, PALETTE.sky).setOrigin(0).setScrollFactor(0).setDepth(-99);
    this.sun = scene.add.circle(0, 0, 30, PALETTE.sun).setScrollFactor(0).setDepth(-98);
    this.far = scene.add.tileSprite(0, 0, 10, FAR_H, 'hills-far').setOrigin(0, 1).setScrollFactor(0).setDepth(-90);
    this.near = scene.add.tileSprite(0, 0, 10, NEAR_H, 'hills-near').setOrigin(0, 1).setScrollFactor(0).setDepth(-80);
    this.layout();
  }

  private static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('hills-far')) return;
    Parallax.hillTexture(scene, 'hills-far', FAR_H, PALETTE.hillsFar, [
      [0, 70, 130],
      [256, 60, 160],
      [512, 70, 130],
    ]);
    Parallax.hillTexture(scene, 'hills-near', NEAR_H, PALETTE.hillsNear, [
      [96, 42, 120],
      [352, 36, 150],
      [608, 42, 120],
    ]);
  }

  /** Draws a repeating row of soft bumps into a texture. bumps: [cx, height, radiusX]. */
  private static hillTexture(
    scene: Phaser.Scene,
    key: string,
    height: number,
    color: number,
    bumps: [number, number, number][],
  ): void {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(color, 1);
    for (const [cx, h, rx] of bumps) {
      g.fillEllipse(cx, height, rx * 2, h * 2);
    }
    g.fillRect(0, height - 8, TILE_W, 8);
    g.generateTexture(key, TILE_W, height);
    g.destroy();
  }

  layout(): void {
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const ground = groundScreenY(h);
    this.skyHigh.setSize(w, h);
    this.sky.setPosition(0, h * 0.35).setSize(w, h);
    this.sun.setPosition(w * 0.62, 52);
    this.far.setPosition(0, ground + 6).setSize(w, FAR_H);
    this.near.setPosition(0, ground + 4).setSize(w, NEAR_H);
  }

  update(scrollX: number): void {
    this.far.tilePositionX = scrollX * 0.18;
    this.near.tilePositionX = scrollX * 0.42;
  }
}
