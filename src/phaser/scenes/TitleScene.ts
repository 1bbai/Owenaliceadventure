import Phaser from 'phaser';
import { HEROES, HERO_IDS, type HeroId } from '../../game/heroes';
import { TRACKS, type TrackId } from '../../game/tracks';
import { PALETTE } from '../palette';
import { getSession, updateSession } from '../session';
import { Button } from '../ui/Button';
import { fitText, makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { getSfx } from '../sfx';
import { SCENES } from './keys';

/** Title screen: pick a hero, pick the player's age, press Play. */
export class TitleScene extends Phaser.Scene {
  private heroButtons = new Map<HeroId, Button>();
  private trackButtons = new Map<TrackId, Button>();

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const session = getSession();
    new Parallax(this);

    // Panel.
    const panelW = Math.min(w - 24, 620);
    const panelH = Math.min(h - 16, 318);
    const cx = w / 2;
    const cy = h / 2 - 6;
    const panel = this.add.graphics();
    panel.fillStyle(PALETTE.panelShadow, 0.35);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2 + 5, panelW, panelH, 22);
    panel.fillStyle(PALETTE.panel, 0.94);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 22);

    let y = cy - panelH / 2 + 34;
    fitText(makeText(this, cx, y, "Owen & Alice's Adventure", 'title'), panelW - 40);

    y += 46;
    makeText(this, cx, y, 'Choose your hero', 'heading');
    y += 38;
    const heroW = Math.min(250, (panelW - 48) / 2);
    HERO_IDS.forEach((id, i) => {
      const hero = HEROES[id];
      const x = cx + (i === 0 ? -1 : 1) * (heroW / 2 + 8);
      const b = new Button(this, x, y, {
        width: heroW,
        height: 52,
        label: hero.pickLabel,
        selected: session.hero === id,
        onPress: () => this.pickHero(id),
      });
      this.heroButtons.set(id, b);
    });

    y += 52;
    makeText(this, cx, y, 'How old is the player?', 'heading');
    y += 38;
    const trackW = Math.min(170, (panelW - 56) / 3);
    TRACKS.forEach((track, i) => {
      const x = cx + (i - 1) * (trackW + 8);
      const b = new Button(this, x, y, {
        width: trackW,
        height: 52,
        label: track.label,
        selected: session.track === track.id,
        onPress: () => this.pickTrack(track.id),
      });
      this.trackButtons.set(track.id, b);
    });

    y += 60;
    new Button(this, cx, y, {
      width: 220,
      height: 58,
      label: 'Play',
      size: 'heading',
      fill: PALETTE.buttonPlay,
      onPress: () => this.play(),
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.play());
    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }

  private pickHero(id: HeroId): void {
    getSfx().play('tap');
    updateSession({ hero: id });
    for (const [key, b] of this.heroButtons) b.setSelected(key === id);
  }

  private pickTrack(id: TrackId): void {
    getSfx().play('tap');
    updateSession({ track: id });
    for (const [key, b] of this.trackButtons) b.setSelected(key === id);
  }

  private play(): void {
    getSfx().play('tap');
    this.scene.start(SCENES.game);
  }
}
