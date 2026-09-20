import Phaser from 'phaser';
import { PROFILES } from '../../game/config';
import { HEROES, HERO_IDS, type HeroId } from '../../game/heroes';
import { TRACKS, type TrackId } from '../../game/tracks';
import { PALETTE } from '../palette';
import { getSfx } from '../sfx';
import { getProfiles } from '../storage';
import { Button } from '../ui/Button';
import { BACKSPACE, KeyPad, LETTER_ROWS } from '../ui/KeyPad';
import { menuPanel, type PanelBox } from '../ui/Panel';
import { makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { SCENES, type NewPlayerData } from './keys';

type Step = 'name' | 'age' | 'hero';

/** Shows a typed name as "Owen" however it was typed. */
export function displayName(typed: string): string {
  if (typed.length === 0) return '';
  return typed[0]!.toUpperCase() + typed.slice(1).toLowerCase();
}

/**
 * Three quick steps to add a player: type a nickname on a big on-screen
 * keyboard, pick the age band, pick a favourite hero. Nothing else is asked.
 */
export class NewPlayerScene extends Phaser.Scene {
  private first = false;
  private step: Step = 'name';
  private typed = '';
  private track: TrackId = 0;
  private hero: HeroId = 'alice';
  private content!: Phaser.GameObjects.Container;
  private panel!: PanelBox;
  private nameBox: Phaser.GameObjects.Container | null = null;
  private nameText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.newPlayer);
  }

  init(data: NewPlayerData): void {
    this.first = data.first ?? false;
    this.step = 'name';
    this.typed = '';
    this.track = 0;
    this.hero = 'alice';
  }

  create(): void {
    if (getProfiles().isFull()) {
      this.scene.start(SCENES.players);
      return;
    }
    new Parallax(this);
    this.panel = menuPanel(this);
    this.content = this.add.container(0, 0);
    this.render();
    this.input.keyboard?.on('keydown', this.onKeyDown, this);
    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart({ first: this.first }));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.step === 'name') {
      if (/^[a-zA-Z]$/.test(e.key)) this.type(e.key.toUpperCase());
      else if (e.key === 'Backspace') this.type(BACKSPACE);
      else if (e.key === 'Enter') this.next();
    } else if (e.key === 'Enter') {
      this.next();
    }
  }

  private render(): void {
    this.content.removeAll(true);
    this.nameBox = null;
    this.nameText = null;
    if (this.step === 'name') this.renderName();
    else if (this.step === 'age') this.renderAge();
    else this.renderHero();
  }

  private renderName(): void {
    const { cx, top, width } = this.panel;
    this.content.add(makeText(this, cx, top + 28, 'What is your name?', 'heading'));

    const boxW = Math.min(320, width - 48);
    const box = this.add.container(cx, top + 66);
    const g = this.add.graphics();
    g.fillStyle(PALETTE.buttonSelected, 1);
    g.fillRoundedRect(-boxW / 2, -22, boxW, 44, 14);
    g.lineStyle(2, PALETTE.buttonEdge, 0.6);
    g.strokeRoundedRect(-boxW / 2, -22, boxW, 44, 14);
    this.nameText = makeText(this, 0, 0, '', 'heading');
    box.add([g, this.nameText]);
    this.content.add(box);
    this.nameBox = box;
    this.refreshName();

    const keyW = Math.min(46, (width - 48 - 8 * 5) / 9);
    const pad = new KeyPad(this, cx, top + 161, {
      rows: LETTER_ROWS,
      keyWidth: keyW,
      keyHeight: 40,
      gap: 5,
      onKey: (k) => this.type(k),
    });
    this.content.add(pad);

    this.content.add(this.navButtons(top + 258, 'Next', !this.first));
  }

  private refreshName(): void {
    if (!this.nameText) return;
    const shown = displayName(this.typed);
    this.nameText.setText(shown.length > 0 ? shown : 'Type your name').setColor(shown.length > 0 ? '#23405c' : '#8aa0b5');
  }

  private type(key: string): void {
    getSfx().play('tap');
    if (key === BACKSPACE) this.typed = this.typed.slice(0, -1);
    else if (this.typed.length < PROFILES.nicknameMax) this.typed += key;
    this.refreshName();
  }

  private renderAge(): void {
    const { cx, top, width } = this.panel;
    this.content.add(makeText(this, cx, top + 30, `How old is ${displayName(this.typed)}?`, 'heading'));
    this.content.add(
      makeText(this, cx, top + 64, 'This sets the run speed and the questions. Grown-ups can change it later.', 'small', PALETTE.panelShadow, {
        wordWrap: { width: width - 48 },
      }),
    );
    const trackW = Math.min(170, (width - 56) / 3);
    const buttons = new Map<TrackId, Button>();
    TRACKS.forEach((track, i) => {
      const b = new Button(this, cx + (i - 1) * (trackW + 8), top + 130, {
        width: trackW,
        height: 56,
        label: track.label,
        selected: this.track === track.id,
        onPress: () => {
          getSfx().play('tap');
          this.track = track.id;
          for (const [id, button] of buttons) button.setSelected(id === track.id);
        },
      });
      buttons.set(track.id, b);
      this.content.add(b);
    });
    this.content.add(this.navButtons(top + 218, 'Next', true));
  }

  private renderHero(): void {
    const { cx, top, width } = this.panel;
    this.content.add(makeText(this, cx, top + 30, 'Choose your hero', 'heading'));
    this.content.add(makeText(this, cx, top + 64, 'You can swap heroes any time on the title screen.', 'small', PALETTE.panelShadow));
    const heroW = Math.min(250, (width - 48) / 2);
    const buttons = new Map<HeroId, Button>();
    HERO_IDS.forEach((id, i) => {
      const b = new Button(this, cx + (i === 0 ? -1 : 1) * (heroW / 2 + 8), top + 130, {
        width: heroW,
        height: 56,
        label: HEROES[id].pickLabel,
        selected: this.hero === id,
        onPress: () => {
          getSfx().play('tap');
          this.hero = id;
          for (const [key, button] of buttons) button.setSelected(key === id);
        },
      });
      buttons.set(id, b);
      this.content.add(b);
    });
    this.content.add(this.navButtons(top + 218, "Let's go!", true));
  }

  /** Back on the left (when there is somewhere to go back to) and the forward button on the right. */
  private navButtons(y: number, forwardLabel: string, showBack: boolean): Phaser.GameObjects.Container {
    const { cx, width } = this.panel;
    const row = this.add.container(0, 0);
    const bw = Math.min(200, (width - 48) / 2);
    if (showBack) {
      row.add(
        new Button(this, cx - bw / 2 - 8, y, {
          width: bw,
          height: 48,
          label: 'Back',
          onPress: () => this.back(),
        }),
      );
    }
    row.add(
      new Button(this, showBack ? cx + bw / 2 + 8 : cx, y, {
        width: bw,
        height: 48,
        label: forwardLabel,
        fill: PALETTE.buttonPlay,
        onPress: () => this.next(),
      }),
    );
    return row;
  }

  private back(): void {
    getSfx().play('tap');
    if (this.step === 'name') {
      this.scene.start(SCENES.players);
      return;
    }
    this.step = this.step === 'hero' ? 'age' : 'name';
    this.render();
  }

  private next(): void {
    if (this.step === 'name') {
      if (this.typed.length === 0) {
        if (this.nameBox) this.tweens.add({ targets: this.nameBox, x: this.nameBox.x + 8, duration: 50, yoyo: true, repeat: 3 });
        return;
      }
      getSfx().play('tap');
      this.step = 'age';
    } else if (this.step === 'age') {
      getSfx().play('tap');
      this.step = 'hero';
    } else {
      getSfx().play('lockOpen');
      getProfiles().create({ nickname: displayName(this.typed), track: this.track, hero: this.hero });
      this.scene.start(SCENES.title);
      return;
    }
    this.render();
  }
}
