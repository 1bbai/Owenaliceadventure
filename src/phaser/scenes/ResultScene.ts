import Phaser from 'phaser';
import { grownUpsLine, resultStars } from '../../game/scoring';
import { PALETTE } from '../palette';
import { getSfx } from '../sfx';
import { Button } from '../ui/Button';
import { menuPanel } from '../ui/Panel';
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
    gateOpened: false,
    questionsAsked: 0,
    rightFirstTime: 0,
    cluesUsed: 0,
    respawns: 0,
    skills: [],
    nickname: 'Player',
    totalStars: 0,
    bestStars: 0,
  };

  constructor() {
    super(SCENES.result);
  }

  init(data: Partial<ResultData>): void {
    this.data$ = { ...this.data$, ...data };
  }

  create(): void {
    const w = this.scale.width;
    const cx = w / 2;
    new Parallax(this);
    this.cameras.main.fadeIn(400, 255, 255, 255);

    const panel = menuPanel(this, 600);
    const panelW = panel.width;

    let y = panel.top + 34;
    fitText(makeText(this, cx, y, `${this.data$.levelName} done!`, 'title'), panelW - 40);

    const stars = resultStars(this.data$);
    const earned = [stars.finished, stars.allShards, stars.third];
    const labels = ['Finished the level', `Found ${this.data$.shardsFound} of ${this.data$.shardsTotal} shards`, stars.thirdLabel];
    y += 70;
    const starGap = Math.min(190, (panelW - 40) / 3);
    earned.forEach((on, i) => {
      const x = cx + (i - 1) * starGap;
      const star = this.add.star(x, y, 5, 16, 34, on ? PALETTE.star : PALETTE.checkpointOff).setStrokeStyle(3, on ? PALETTE.starEdge : PALETTE.cloudDark);
      fitText(makeText(this, x, y + 46, labels[i]!, 'small'), starGap - 8);
      if (on) {
        star.setScale(0);
        this.tweens.add({ targets: star, scaleX: 1, scaleY: 1, delay: 250 + i * 250, duration: 450, ease: 'Back.easeOut' });
      }
    });

    y += 76;
    makeText(this, cx, y, `Stars collected: ${this.data$.starsCollected} of ${this.data$.starsTotal}`, 'heading');

    // The player's running total and their best on this level (saved on this device only).
    y += 24;
    fitText(
      makeText(this, cx, y, `${this.data$.nickname}: ${this.data$.totalStars} stars in total. Best on this level: ${this.data$.bestStars} of 3.`, 'small', PALETTE.text, {
        fontSize: '13px',
      }),
      panelW - 40,
    );

    // One small line for grown-ups: what was practised and how it went.
    y += 26;
    makeText(this, cx, y, grownUpsLine(this.data$), 'small', PALETTE.panelShadow, {
      fontSize: '12px',
      wordWrap: { width: panelW - 40 },
    });

    y += 46;
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
      label: 'Change player or hero',
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.title);
      },
    });

    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart(this.data$));
  }
}
