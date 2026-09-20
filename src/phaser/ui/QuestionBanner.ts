import type Phaser from 'phaser';
import { QUESTIONS } from '../../game/config';
import { clueLine, type Clue, type Question } from '../../game/learning/questions';
import { PALETTE } from '../palette';
import { sparkle } from '../views/Burst';
import { fitText, makeText } from './text';

/** Banner line heights. Line one holds the locks and the question; line two, when needed, the clue. */
export const BANNER = {
  lineHeight: 32,
  clueLineHeight: 34,
  sideMargin: 6,
} as const;

/**
 * A slim banner across the very top of the screen: three small locks and the
 * question, plus the sidekick's clue on a second slim line when the question
 * comes round again. It never covers the bubbles: on the smallest view the
 * bubbles' tops sit more than 150 units down.
 */
export class QuestionBanner {
  private readonly container: Phaser.GameObjects.Container;
  private question: Question | null = null;
  private attempt = 0;
  private locks = 0;
  private sidekickName = '';
  private lockIcons: Phaser.GameObjects.Graphics[] = [];
  private visible = false;

  constructor(private readonly scene: Phaser.Scene) {
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(110);
    this.container.setVisible(false);
  }

  /** Total height of the banner while it is showing, 0 when hidden. */
  get height(): number {
    if (!this.visible) return 0;
    return BANNER.lineHeight + (this.attempt > 0 ? BANNER.clueLineHeight : 0);
  }

  show(question: Question, attempt: number, sidekickName: string, locks: number): void {
    this.question = question;
    this.attempt = attempt;
    this.sidekickName = sidekickName;
    this.locks = locks;
    this.visible = true;
    this.render();
    this.container.setVisible(true).setAlpha(1);
  }

  /** A lock opens: redraw it open and sparkle. */
  openLock(locks: number): void {
    this.locks = locks;
    const icon = this.lockIcons[locks - 1];
    if (!icon) return;
    this.drawLock(icon, true);
    sparkle(this.scene, icon.x, icon.y + 2, 6, 0);
    this.scene.tweens.add({ targets: icon, scaleX: 1.5, scaleY: 1.5, duration: 140, yoyo: true });
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        if (!this.visible) this.container.setVisible(false);
      },
    });
  }

  layout(): void {
    if (this.visible) this.render();
  }

  private drawLock(g: Phaser.GameObjects.Graphics, open: boolean): void {
    g.clear();
    if (open) {
      g.lineStyle(2.5, PALETTE.starEdge, 1);
      g.beginPath();
      g.arc(4, -6, 4.5, Math.PI, Math.PI * 1.9, false);
      g.strokePath();
      g.fillStyle(PALETTE.star, 1);
    } else {
      g.lineStyle(2.5, PALETTE.cloudDark, 1);
      g.beginPath();
      g.arc(0, -3, 4.5, Math.PI, Math.PI * 2, false);
      g.strokePath();
      g.fillStyle(PALETTE.cloudDark, 1);
    }
    g.fillRoundedRect(-7, -2, 14, 11, 3);
    g.fillStyle(open ? PALETTE.starEdge : PALETTE.cloud, 1);
    g.fillCircle(0, 3, 1.8);
  }

  private render(): void {
    const q = this.question;
    if (!q) return;
    const s = this.scene;
    const width = s.scale.width;
    const height = this.height;
    this.container.removeAll(true);
    this.lockIcons = [];

    const bg = s.add.graphics();
    bg.fillStyle(PALETTE.panel, 0.9);
    bg.fillRoundedRect(BANNER.sideMargin, 0, width - BANNER.sideMargin * 2, height, 10);
    bg.lineStyle(2, PALETTE.skyHigh, 0.6);
    bg.strokeRoundedRect(BANNER.sideMargin, 0, width - BANNER.sideMargin * 2, height, 10);
    this.container.add(bg);

    // Line one: locks, stars for counting questions, the question.
    const y1 = BANNER.lineHeight / 2;
    let x = BANNER.sideMargin + 14;
    for (let i = 0; i < QUESTIONS.locks; i++) {
      const icon = s.add.graphics({ x, y: y1 });
      this.drawLock(icon, i < this.locks);
      this.lockIcons.push(icon);
      this.container.add(icon);
      x += 22;
    }
    x += 6;
    if (q.stars > 0) {
      x = this.drawStarRow(x, y1, q.stars, false);
      x += 8;
    }
    const right = width - BANNER.sideMargin - 10;
    const text = makeText(s, x, y1, q.text, 'body', PALETTE.text, { fontStyle: 'bold' }).setOrigin(0, 0.5);
    fitText(text, Math.max(40, right - x));
    this.container.add(text);

    // Line two: the sidekick's clue.
    if (this.attempt > 0) {
      const y2 = BANNER.lineHeight + BANNER.clueLineHeight / 2;
      let cx = BANNER.sideMargin + 12;
      const line = makeText(s, cx, y2, clueLine(this.sidekickName), 'small', PALETTE.shardEdge, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      this.container.add(line);
      cx += line.width + 12;
      this.drawClue(q.clue, cx, y2, right);
    }
  }

  /** A row of small stars starting at x; returns the x just after the row. */
  private drawStarRow(x: number, y: number, count: number, numbered: boolean): number {
    const spacing = 15;
    for (let i = 0; i < count; i++) {
      const sx = x + 6 + i * spacing;
      const star = this.scene.add.star(sx, numbered ? y - 5 : y, 5, 3, 6.5, PALETTE.star).setStrokeStyle(1.5, PALETTE.starEdge);
      this.container.add(star);
      if (numbered) this.container.add(makeText(this.scene, sx, y + 9, String(i + 1), 'small', PALETTE.text, { fontSize: '11px' }));
    }
    return x + 6 + count * spacing;
  }

  /** Groups of dots starting at x; `faded` leading dots are drawn pale. Returns the x after the last dot. */
  private drawDots(x: number, y: number, groups: readonly number[], faded = 0): number {
    const spacing = 9;
    const gap = 8;
    let cx = x;
    let index = 0;
    for (const n of groups) {
      for (let i = 0; i < n; i++) {
        const pale = index < faded;
        const dot = this.scene.add.circle(cx + 4, y, 3.4, pale ? PALETTE.cloud : PALETTE.starEdge, pale ? 0.35 : 1);
        this.container.add(dot);
        cx += spacing;
        index++;
      }
      cx += gap;
    }
    return cx;
  }

  private drawClue(clue: Clue, x: number, y: number, right: number): void {
    switch (clue.kind) {
      case 'numberedStars':
        this.drawStarRow(x, y, clue.count, true);
        break;
      case 'dotGroups':
        this.drawDots(x, y, clue.groups);
        break;
      case 'fadedDots':
        this.drawDots(x, y, [clue.total], clue.faded);
        break;
      case 'text': {
        const t = makeText(this.scene, x, y, clue.text, 'small', PALETTE.text).setOrigin(0, 0.5);
        fitText(t, Math.max(40, right - x));
        this.container.add(t);
        break;
      }
    }
  }
}
