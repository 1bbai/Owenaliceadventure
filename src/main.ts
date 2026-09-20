import Phaser from 'phaser';
import { isPortrait, logicalViewSize } from './game/viewport';
import { GameScene } from './phaser/scenes/GameScene';
import { ResultScene } from './phaser/scenes/ResultScene';
import { TitleScene } from './phaser/scenes/TitleScene';

const initial = logicalViewSize(window.innerWidth, window.innerHeight);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#7ec8f2',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: initial.width,
    height: initial.height,
  },
  render: { antialias: true, roundPixels: false },
  input: { activePointers: 2 },
  scene: [TitleScene, GameScene, ResultScene],
});

/** Landscape only: in portrait, show the "turn your device" screen and pause the game. */
function applyOrientation(): void {
  const portrait = isPortrait(window.innerWidth, window.innerHeight);
  document.body.classList.toggle('portrait', portrait);
  if (portrait) {
    if (!game.isPaused) game.pause();
  } else {
    if (game.isPaused) game.resume();
    const size = logicalViewSize(window.innerWidth, window.innerHeight);
    if (size.width !== game.scale.gameSize.width || size.height !== game.scale.gameSize.height) {
      game.scale.setGameSize(size.width, size.height);
    }
    game.scale.refresh();
  }
}

// Development only: lets browser automation reach the game (stripped from production builds).
if (import.meta.env.DEV) (window as unknown as { game?: Phaser.Game }).game = game;

window.addEventListener('resize', applyOrientation);
window.addEventListener('orientationchange', applyOrientation);
game.events.once(Phaser.Core.Events.READY, applyOrientation);
applyOrientation();
