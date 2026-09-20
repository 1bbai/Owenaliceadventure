import Phaser from 'phaser';
import { resultStars } from '../../game/scoring';
import { PALETTE } from '../palette';
import { getSfx } from '../sfx';
import { Button } from '../ui/Button';
import { fitText, makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { SCENES, type ResultData } from './keys';

/** End-of-level screen: three big stars, the star count, and two ways onward. */
export class ResultScene extends Phaser.Scene {
  private data$: ResultData = {
    levelName: 'Sunny Meadows 1',
    finished: true,
    shardsFound: 0,
    shardsTotal: 3,
    starsCollected: 0,
    starsTotal: 0,
  };

  constructor() {
    super(SCENES.result);
  }

  init(data: Partial<ResultData>): void {
    this.data$ = { ...this.data$, ...data };
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const cx = w / 2;
    new Parallax(this);
    this.cameras.main.fadeIn(400, 255, 255, 255);

    const panelW = Math.min(w - 24, 600);
    const panelH = Math.min(h - 16, 318);
    const cy = h / 2 - 6;
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelShadow, 0.35);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2 + 5, panelW, panelH, 22);
    panel.fillStyle(PALETTE.panel, 0.94);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 22);

    let y = cy - panelH / 2 + 34;
    fitText(makeText(this, cx, y, `${this.data$.levelName} done!`, 'title'), panelW - 40);

    const stars = resultStars(this.data$);
    const earned = [stars.finished, stars.allShards, stars.third];
    const labels = ['Finished the level', `Found ${this.data$.shardsFound} of ${this.data$.shardsTotal} shards`, stars.thirdLabel];
    y += 82;
    earned.forEach((on, i) => {
      const x = cx + (i - 1) * 150;
      const star = this.add.star(x, y, 5, 16, 34, on ? PALETTE.star : PALETTE.checkpointOff).setStrokeStyle(3, on ? PALETTE.starEdge : PALETTE.cloudDark);
      makeText(this, x, y + 48, labels[i]!, 'small');
      if (on) {
        star.setScale(0);
        this.tweens.add({ targets: star, scaleX: 1, scaleY: 1, delay: 250 + i * 250, duration: 450, ease: 'Back.easeOut' });
      }
    });

    y += 92;
    makeText(this, cx, y, `Stars collected: ${this.data$.starsCollected} of ${this.data$.starsTotal}`, 'heading');

    y += 56;
    const bw = Math.min(250, (panelW - 48) / 2);
    new Button(this, cx - bw / 2 - 8, y, {
      width: bw,
      height: 54,
      label: 'Play again',
      fill: PALETTE.buttonPlay,
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.game);
      },
    });
    new Button(this, cx + bw / 2 + 8, y, {
      width: bw,
      height: 54,
      label: 'Change hero or age',
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.title);
      },
    });

    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart(this.data$));
  }
}
