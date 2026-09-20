import Phaser from 'phaser';
import { PROFILES } from '../../game/config';
import { getTrack } from '../../game/tracks';
import { PALETTE } from '../palette';
import { getSfx } from '../sfx';
import { getProfiles } from '../storage';
import { Button } from '../ui/Button';
import { menuPanel } from '../ui/Panel';
import { makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { SCENES, type NewPlayerData } from './keys';

/** Who is playing: up to four players on this device, plus "New player" while there is room. */
export class PlayersScene extends Phaser.Scene {
  constructor() {
    super(SCENES.players);
  }

  create(): void {
    const store = getProfiles();
    const profiles = store.list();
    if (profiles.length === 0) {
      const data: NewPlayerData = { first: true };
      this.scene.start(SCENES.newPlayer, data);
      return;
    }
    const active = store.active();
    new Parallax(this);
    const panel = menuPanel(this);
    const { cx, top, width } = panel;

    makeText(this, cx, top + 30, 'Who is playing?', 'heading');

    const bw = Math.min(280, (width - 48) / 2);
    profiles.forEach((p, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = cx + (col === 0 ? -1 : 1) * (bw / 2 + 6);
      const y = top + 90 + row * 66;
      new Button(this, x, y, {
        width: bw,
        height: 58,
        label: `${p.nickname}\n${getTrack(p.track).label}  ·  ${p.progress.totalStars} stars`,
        size: 'small',
        selected: p.id === active?.id,
        onPress: () => {
          getSfx().play('tap');
          store.setActive(p.id);
          this.scene.start(SCENES.title);
        },
      });
    });

    const y = top + 90 + 2 * 66 + 4;
    const canAdd = profiles.length < PROFILES.max;
    new Button(this, canAdd ? cx - bw / 2 - 6 : cx, y, {
      width: bw,
      height: 48,
      label: 'Back',
      onPress: () => {
        getSfx().play('tap');
        this.scene.start(SCENES.title);
      },
    });
    if (canAdd) {
      new Button(this, cx + bw / 2 + 6, y, {
        width: bw,
        height: 48,
        label: 'New player',
        fill: PALETTE.buttonPlay,
        onPress: () => {
          getSfx().play('tap');
          const data: NewPlayerData = { first: false };
          this.scene.start(SCENES.newPlayer, data);
        },
      });
    } else {
      makeText(this, cx, y + 36, `Up to ${PROFILES.max} players fit on one device. Grown-ups can remove a player.`, 'small', PALETTE.panelShadow, {
        fontSize: '12px',
      });
    }

    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }
}
