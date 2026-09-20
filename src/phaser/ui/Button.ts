import Phaser from 'phaser';
import { PALETTE } from '../palette';
import { makeText, type TextSize } from './text';

export interface ButtonOptions {
  width: number;
  height: number;
  label: string;
  size?: TextSize;
  fill?: number;
  selected?: boolean;
  onPress: () => void;
}

/**
 * A big, friendly rounded button. Minimum size is kept large for small hands.
 * Selection state is shown with a warm fill and a thicker outline.
 */
export class Button extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly opts: ButtonOptions;
  private selected: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: ButtonOptions) {
    super(scene, x, y);
    this.opts = opts;
    this.selected = opts.selected ?? false;
    this.bg = scene.add.graphics();
    this.label = makeText(scene, 0, 0, opts.label, opts.size ?? 'body');
    this.label.setWordWrapWidth(opts.width - 24);
    this.add([this.bg, this.label]);
    this.setSize(opts.width, opts.height);
    this.draw();
    const hit = new Phaser.Geom.Rectangle(-opts.width / 2, -opts.height / 2, opts.width, opts.height);
    this.setInteractive({ hitArea: hit, hitAreaCallback: Phaser.Geom.Rectangle.Contains, useHandCursor: true });
    this.on(Phaser.Input.Events.POINTER_DOWN, () => {
      scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.94, duration: 70, yoyo: true });
    });
    this.on(Phaser.Input.Events.POINTER_UP, () => opts.onPress());
    scene.add.existing(this);
  }

  setSelected(on: boolean): this {
    this.selected = on;
    this.draw();
    return this;
  }

  private draw(): void {
    const { width, height } = this.opts;
    const fill = this.selected ? PALETTE.buttonSelected : (this.opts.fill ?? PALETTE.button);
    const g = this.bg;
    g.clear();
    g.fillStyle(PALETTE.panelShadow, 0.35);
    g.fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 16);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(-width / 2, -height / 2, width, height, 16);
    g.lineStyle(this.selected ? 4 : 2, PALETTE.buttonEdge, this.selected ? 1 : 0.5);
    g.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);
  }
}
