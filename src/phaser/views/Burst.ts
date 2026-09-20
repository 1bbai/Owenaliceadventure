import type Phaser from 'phaser';
import { PALETTE } from '../palette';

/** A popped cloud bursts into flowers (Alice) or raindrops (Owen). */
export function burst(scene: Phaser.Scene, x: number, y: number, kind: 'flowers' | 'raindrops'): void {
  const count = 9;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 40 + Math.random() * 40;
    let bit: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.AlphaSingle;
    if (kind === 'flowers') {
      const c = scene.add.container(x, y).setDepth(40);
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        c.add(scene.add.circle(Math.cos(a) * 5, Math.sin(a) * 5, 4, PALETTE.flower));
      }
      c.add(scene.add.circle(0, 0, 3, PALETTE.flowerCentre));
      bit = c;
    } else {
      bit = scene.add.ellipse(x, y, 7, 12, PALETTE.raindrop).setDepth(40);
    }
    scene.tweens.add({
      targets: bit,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist + (kind === 'raindrops' ? 60 : 20),
      alpha: 0,
      angle: kind === 'flowers' ? 180 : 0,
      duration: 550 + Math.random() * 200,
      ease: 'Quad.easeOut',
      onComplete: () => bit.destroy(),
    });
  }
}
