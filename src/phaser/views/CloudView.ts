import Phaser from 'phaser';
import { CLOUD } from '../../game/config';
import type { Cloud } from '../../game/level/types';
import { cloudY } from '../../game/sim/heroSim';
import { PALETTE } from '../palette';

/** A sulky storm cloud: three puffs, heavy brows and a small frown. Never scary. */
export class CloudView extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, readonly cloud: Cloud) {
    super(scene, cloud.x, cloud.y);
    const g = scene.add.graphics();
    const w = CLOUD.width;
    const h = CLOUD.height;
    g.fillStyle(PALETTE.cloudDark, 1);
    g.fillEllipse(0, 4, w + 6, h);
    g.fillStyle(PALETTE.cloud, 1);
    g.fillCircle(-w / 4, 0, h / 2);
    g.fillCircle(w / 4, 0, h / 2);
    g.fillCircle(0, -4, h / 2 + 3);
    g.fillEllipse(0, 3, w, h - 4);
    // Grumpy face.
    g.fillStyle(PALETTE.cloudFace, 1);
    g.fillCircle(-7, -1, 2.4);
    g.fillCircle(7, -1, 2.4);
    g.lineStyle(2.5, PALETTE.cloudFace, 1);
    g.lineBetween(-11, -7, -3, -4);
    g.lineBetween(11, -7, 3, -4);
    g.beginPath();
    g.arc(0, 10, 5, Math.PI * 1.15, Math.PI * 1.85, false);
    g.strokePath();
    this.add(g);
    this.setDepth(30);
    scene.add.existing(this);
  }

  /** Follows the sim's bobbing so what you see is what you hit. */
  sync(t: number): void {
    this.y = cloudY(this.cloud, t);
  }
}
