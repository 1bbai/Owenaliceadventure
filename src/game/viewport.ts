import { VIEW } from './config';

export interface ViewSize {
  width: number;
  height: number;
}

/**
 * Chooses the logical view size for a device window. The view is never smaller
 * than VIEW.minWidth x VIEW.minHeight; wider or taller screens see more world
 * instead of being letterboxed. The result is scaled to fit the window (Phaser FIT).
 */
export function logicalViewSize(windowWidth: number, windowHeight: number): ViewSize {
  const w = Math.max(1, windowWidth);
  const h = Math.max(1, windowHeight);
  const aspect = w / h;
  const minAspect = VIEW.minWidth / VIEW.minHeight;
  if (aspect >= minAspect) {
    return { width: Math.round(VIEW.minHeight * aspect), height: VIEW.minHeight };
  }
  return { width: VIEW.minWidth, height: Math.round(VIEW.minWidth / aspect) };
}

export function isPortrait(windowWidth: number, windowHeight: number): boolean {
  return windowHeight > windowWidth;
}

/** Screen y of the ground line for a view of the given height. */
export function groundScreenY(viewHeight: number): number {
  return viewHeight - VIEW.groundFromBottom;
}

/** Camera scroll so that the hero sits VIEW.heroScreenX of the way across the view. */
export function cameraScrollX(heroX: number, viewWidth: number): number {
  return heroX - viewWidth * VIEW.heroScreenX;
}
