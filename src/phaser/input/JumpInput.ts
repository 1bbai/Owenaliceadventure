import Phaser from 'phaser';

/**
 * The game's single control. Touch anywhere, mouse button, Space or the Up arrow
 * all feed the same "held" flag. Presses over UI buttons are ignored.
 */
export class JumpInput {
  private pointerHeld = false;
  private keyHeld = false;
  /** A press happened since the last read; guarantees even a very short tap is seen once. */
  private pendingPress = false;
  private readonly keys: Phaser.Input.Keyboard.Key[] = [];
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    scene.input.on(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);
    const kb = scene.input.keyboard;
    if (kb) {
      this.keys.push(kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE), kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP));
      for (const k of this.keys) {
        k.on('down', () => {
          if (!this.keyHeld) this.pendingPress = true;
          this.keyHeld = true;
        });
        k.on('up', () => {
          this.keyHeld = this.keys.some((other) => other !== k && other.isDown);
        });
      }
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private onPointerDown(_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]): void {
    if (currentlyOver.length > 0) return;
    this.pointerHeld = true;
    this.pendingPress = true;
  }

  private onPointerUp(): void {
    this.pointerHeld = false;
  }

  /** True while the button is down. Also true once for a tap that started and ended between reads. */
  read(): boolean {
    const held = this.pointerHeld || this.keyHeld || this.pendingPress;
    this.pendingPress = false;
    return held;
  }

  destroy(): void {
    this.scene.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.POINTER_UP_OUTSIDE, this.onPointerUp, this);
    this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.onPointerUp, this);
    for (const k of this.keys) k.destroy();
    this.keys.length = 0;
  }
}
