import Phaser from 'phaser';
import { HEROES, HERO_IDS, type HeroId } from '../../game/heroes';
import { getTrack } from '../../game/tracks';
import { PALETTE } from '../palette';
import { getSfx } from '../sfx';
import { getProfiles } from '../storage';
import { Button } from '../ui/Button';
import { menuPanel } from '../ui/Panel';
import { fitText, makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { SCENES, type NewPlayerData } from './keys';

/**
 * Title screen: who is playing (tap to switch), the favourite hero, Play,
 * and the door to the grown-ups corner. On first launch there is no player
 * yet, so it hands over to the new-player screen.
 */
export class TitleScene extends Phaser.Scene {
  private heroButtons = new Map<HeroId, Button>();

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    const store = getProfiles();
    const profile = store.active();
    if (!profile) {
      const data: NewPlayerData = { first: true };
      this.scene.start(SCENES.newPlayer, data);
      return;
    }
    this.heroButtons.clear();
    new Parallax(this);
    const panel = menuPanel(this);
    const { cx } = panel;

    let y = panel.top + 34;
    fitText(makeText(this, cx, y, "Owen & Alice's Adventure", 'title'), panel.width - 40);

    y += 44;
    makeText(this, cx, y, 'Who is playing?', 'heading');
    y += 38;
    new Button(this, cx, y, {
      width: Math.min(360, panel.width - 48),
      height: 46,
      label: `${profile.nickname}  ·  ${getTrack(profile.track).label}`,
      selected: true,
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.players);
      },
    });

    y += 46;
    makeText(this, cx, y, 'Choose your hero', 'heading');
    y += 40;
    const heroW = Math.min(250, (panel.width - 48) / 2);
    HERO_IDS.forEach((id, i) => {
      const hero = HEROES[id];
      const x = cx + (i === 0 ? -1 : 1) * (heroW / 2 + 8);
      const b = new Button(this, x, y, {
        width: heroW,
        height: 52,
        label: hero.pickLabel,
        selected: profile.hero === id,
        onPress: () => this.pickHero(profile.id, id),
      });
      this.heroButtons.set(id, b);
    });

    y += 62;
    new Button(this, cx, y, {
      width: 220,
      height: 56,
      label: 'Play',
      size: 'heading',
      fill: PALETTE.buttonPlay,
      onPress: () => this.play(),
    });
    const grownW = Math.min(130, panel.right - (cx + 118) - 8);
    new Button(this, panel.right - 8 - grownW / 2, y, {
      width: grownW,
      height: 44,
      label: 'Grown-ups',
      size: 'small',
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.grownUps);
      },
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.play());
    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }

  private pickHero(profileId: string, id: HeroId): void {
    getSfx().play('tap');
    getProfiles().update(profileId, { hero: id });
    for (const [key, b] of this.heroButtons) b.setSelected(key === id);
  }

  private play(): void {
    getSfx().play('tap');
    this.scene.start(SCENES.game);
  }
}
