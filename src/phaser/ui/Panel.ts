import type Phaser from 'phaser';
import { PALETTE } from '../palette';

export interface PanelBox {
  /** The drawn card, so a screen that redraws itself can put it inside its own container. */
  graphics: Phaser.GameObjects.Graphics;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

/** The soft white card used by every menu screen. Returns its edges for laying out content. */
export function drawPanel(scene: Phaser.Scene, cx: number, cy: number, width: number, height: number, radius = 22): PanelBox {
  const g = scene.add.graphics();
  g.fillStyle(PALETTE.panelShadow, 0.35);
  g.fillRoundedRect(cx - width / 2, cy - height / 2 + 5, width, height, radius);
  g.fillStyle(PALETTE.panel, 0.94);
  g.fillRoundedRect(cx - width / 2, cy - height / 2, width, height, radius);
  return {
    graphics: g,
    left: cx - width / 2,
    top: cy - height / 2,
    right: cx + width / 2,
    bottom: cy + height / 2,
    width,
    height,
    cx,
    cy,
  };
}

/** The standard menu card: nearly full screen on a phone, capped on a tablet. */
export function menuPanel(scene: Phaser.Scene, maxWidth = 620, maxHeight = 318): PanelBox {
  const w = scene.scale.width;
  const h = scene.scale.height;
  return drawPanel(scene, w / 2, h / 2 - 6, Math.min(w - 24, maxWidth), Math.min(h - 16, maxHeight));
}
