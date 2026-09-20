import type Phaser from 'phaser';
import { FONT, PALETTE, hex } from '../palette';

export type TextSize = 'title' | 'heading' | 'body' | 'small';

const SIZES: Record<TextSize, number> = { title: 40, heading: 22, body: 18, small: 14 };

/** Crisp text at any device pixel ratio, in the game's font. */
export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: TextSize = 'body',
  color: number = PALETTE.text,
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${SIZES[size]}px`,
    fontStyle: size === 'title' || size === 'heading' ? 'bold' : 'normal',
    color: hex(color),
    align: 'center',
    ...extra,
  });
  t.setResolution(Math.min(3, window.devicePixelRatio || 1));
  t.setOrigin(0.5);
  return t;
}

/** Shrinks a text object so it is never wider than maxWidth. */
export function fitText(t: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
  if (t.width > maxWidth) t.setScale(maxWidth / t.width);
  return t;
}
