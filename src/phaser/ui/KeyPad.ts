import Phaser from 'phaser';
import { PALETTE } from '../palette';
import { Button } from './Button';

export const BACKSPACE = '⌫';

export interface KeyPadOptions {
  /** Rows of key labels. Each label is passed to onKey as typed. */
  rows: readonly (readonly string[])[];
  keyWidth: number;
  keyHeight: number;
  gap?: number;
  onKey: (key: string) => void;
  /** Keys drawn with the "go" colour, for example OK. */
  accent?: readonly string[];
}

/**
 * A grid of big on-screen keys (letters for a nickname, digits for the
 * grown-ups gate). Drawn on the canvas so the device keyboard never pops up
 * and shifts the landscape view around. (x, y) is the centre of the grid.
 */
export class KeyPad extends Phaser.GameObjects.Container {
  readonly gridWidth: number;
  readonly gridHeight: number;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: KeyPadOptions) {
    super(scene, x, y);
    const gap = opts.gap ?? 6;
    const cols = Math.max(...opts.rows.map((r) => r.length));
    this.gridWidth = cols * opts.keyWidth + (cols - 1) * gap;
    this.gridHeight = opts.rows.length * opts.keyHeight + (opts.rows.length - 1) * gap;
    opts.rows.forEach((row, r) => {
      const rowWidth = row.length * opts.keyWidth + (row.length - 1) * gap;
      row.forEach((key, c) => {
        const kx = -rowWidth / 2 + opts.keyWidth / 2 + c * (opts.keyWidth + gap);
        const ky = -this.gridHeight / 2 + opts.keyHeight / 2 + r * (opts.keyHeight + gap);
        const button = new Button(scene, kx, ky, {
          width: opts.keyWidth,
          height: opts.keyHeight,
          label: key,
          fill: opts.accent?.includes(key) ? PALETTE.buttonPlay : undefined,
          onPress: () => opts.onKey(key),
        });
        this.add(button);
      });
    });
    scene.add.existing(this);
  }
}

/** Three rows of letters plus backspace, for typing a nickname. */
export const LETTER_ROWS: readonly (readonly string[])[] = [
  [...'ABCDEFGHI'],
  [...'JKLMNOPQR'],
  [...'STUVWXYZ', BACKSPACE],
];

/** A phone-style number pad: 1 to 9, then backspace, 0 and OK. */
export const NUMBER_ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [BACKSPACE, '0', 'OK'],
];
