import Phaser from 'phaser';
import { checkGateAnswer, makeGateQuestion, type GateQuestion } from '../../game/profiles/gate';
import { summarise, type ProfileSummary } from '../../game/profiles/summary';
import type { Profile } from '../../game/profiles/types';
import { TRACKS, getTrack } from '../../game/tracks';
import { PALETTE, hex } from '../palette';
import { getSfx } from '../sfx';
import { isSpeechOn, toggleSpeech } from '../speech';
import { getProfiles } from '../storage';
import { Button } from '../ui/Button';
import { BACKSPACE, KeyPad, NUMBER_ROWS } from '../ui/KeyPad';
import { drawPanel, menuPanel, type PanelBox } from '../ui/Panel';
import { fitText, makeText } from '../ui/text';
import { Parallax } from '../views/Parallax';
import { SCENES } from './keys';

type Section = 'summary' | 'settings';
type Confirm = { kind: 'reset' | 'remove'; profileId: string } | null;

export const PRIVACY_NOTE =
  'Privacy: there are no accounts and no network. Names, stars and results are saved only on this device and never leave it. ' +
  'Reset a player to clear their results, or remove them to delete everything about them.';

/** Most skill rows the summary table shows before it says "and more". */
const MAX_SKILL_ROWS = 7;

/**
 * The grown-ups corner. A multiplication question typed on a number pad
 * keeps children out. Inside: a plain summary of the last 7 days per player,
 * the age band, reset or remove a player, and the read-aloud voice.
 */
export class GrownUpsScene extends Phaser.Scene {
  private unlocked = false;
  private gate!: GateQuestion;
  private typed = '';
  private wrongTries = 0;
  private profileId: string | null = null;
  private section: Section = 'summary';
  private confirm: Confirm = null;
  private content!: Phaser.GameObjects.Container;
  private typedText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SCENES.grownUps);
  }

  create(): void {
    // Always ask the question again on the way in.
    this.unlocked = false;
    this.gate = makeGateQuestion(Math.random);
    this.typed = '';
    this.wrongTries = 0;
    this.section = 'summary';
    this.confirm = null;
    this.profileId = getProfiles().active()?.id ?? null;
    new Parallax(this);
    this.content = this.add.container(0, 0);
    this.render();
    this.input.keyboard?.on('keydown', this.onKeyDown, this);
    this.scale.once(Phaser.Scale.Events.RESIZE, () => this.scene.restart());
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.unlocked) {
      if (e.key === 'Escape') this.leave();
      return;
    }
    if (/^\d$/.test(e.key)) this.press(e.key);
    else if (e.key === 'Backspace') this.press(BACKSPACE);
    else if (e.key === 'Enter') this.press('OK');
    else if (e.key === 'Escape') this.leave();
  }

  private render(): void {
    this.content.removeAll(true);
    this.typedText = null;
    if (this.unlocked) this.renderCorner();
    else this.renderGate();
  }

  private leave(): void {
    getSfx().play('tap');
    this.scene.start(SCENES.title);
  }

  // --- The gate ---------------------------------------------------------

  private renderGate(): void {
    const panel = menuPanel(this);
    this.content.add(panel.graphics);
    const { cx, top } = panel;
    const leftX = cx - 120;
    this.content.add(makeText(this, leftX, top + 34, 'Grown-ups corner', 'heading'));
    this.content.add(makeText(this, leftX, top + 66, 'Ask a grown-up to answer:', 'small', PALETTE.panelShadow));
    this.content.add(makeText(this, leftX, top + 98, this.gate.text, 'heading'));

    const box = this.add.graphics();
    box.fillStyle(PALETTE.buttonSelected, 1);
    box.fillRoundedRect(leftX - 80, top + 122, 160, 44, 14);
    box.lineStyle(2, PALETTE.buttonEdge, 0.6);
    box.strokeRoundedRect(leftX - 80, top + 122, 160, 44, 14);
    this.content.add(box);
    this.typedText = makeText(this, leftX, top + 144, '', 'heading');
    this.content.add(this.typedText);
    this.refreshTyped();

    if (this.wrongTries > 0) {
      this.content.add(makeText(this, leftX, top + 182, 'Not quite. Try this one.', 'small', PALETTE.checkpointOn));
    }
    this.content.add(
      new Button(this, leftX, top + 244, {
        width: 160,
        height: 46,
        label: 'Back',
        onPress: () => this.leave(),
      }),
    );

    const pad = new KeyPad(this, cx + 130, top + 160, {
      rows: NUMBER_ROWS,
      keyWidth: 60,
      keyHeight: 40,
      gap: 6,
      accent: ['OK'],
      onKey: (k) => this.press(k),
    });
    this.content.add(pad);
  }

  private refreshTyped(): void {
    if (!this.typedText) return;
    const empty = this.typed.length === 0;
    this.typedText.setText(empty ? 'Type the answer' : this.typed).setColor(empty ? '#8aa0b5' : hex(PALETTE.text));
  }

  private press(key: string): void {
    getSfx().play('tap');
    if (key === BACKSPACE) {
      this.typed = this.typed.slice(0, -1);
    } else if (key === 'OK') {
      if (checkGateAnswer(this.gate, this.typed)) {
        getSfx().play('lockOpen');
        this.unlocked = true;
        this.render();
        return;
      }
      getSfx().play('wrong');
      this.wrongTries += 1;
      this.typed = '';
      this.gate = makeGateQuestion(Math.random);
      this.render();
      return;
    } else if (this.typed.length < 3) {
      this.typed += key;
    }
    this.refreshTyped();
  }

  // --- The corner -------------------------------------------------------

  private renderCorner(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const panel = drawPanel(this, w / 2, h / 2, Math.min(w - 16, 760), h - 12, 18);
    this.content.add(panel.graphics);
    const store = getProfiles();
    const profiles = store.list();
    const profile = (this.profileId ? store.get(this.profileId) : null) ?? profiles[0] ?? null;
    this.profileId = profile?.id ?? null;

    // Header: title, section tabs, Back.
    const headerY = panel.top + 26;
    this.content.add(makeText(this, panel.left + 16, headerY, 'Grown-ups', 'heading').setOrigin(0, 0.5));
    this.content.add(
      new Button(this, panel.right - 16 - 45, headerY, {
        width: 90,
        height: 40,
        label: 'Back',
        onPress: () => this.leave(),
      }),
    );
    const tabs: { key: Section; label: string; width: number }[] = [
      { key: 'summary', label: 'Last 7 days', width: 120 },
      { key: 'settings', label: 'Settings', width: 100 },
    ];
    let tx = panel.right - 16 - 90 - 14;
    for (const tab of [...tabs].reverse()) {
      tx -= tab.width / 2;
      this.content.add(
        new Button(this, tx, headerY, {
          width: tab.width,
          height: 40,
          label: tab.label,
          size: 'small',
          selected: this.section === tab.key,
          onPress: () => {
            getSfx().play('tap');
            this.section = tab.key;
            this.render();
          },
        }),
      );
      tx -= tab.width / 2 + 6;
    }

    // Player tabs.
    const tabsY = panel.top + 68;
    const tabW = Math.min(150, (panel.width - 32 - 6 * (profiles.length - 1)) / Math.max(1, profiles.length));
    profiles.forEach((p, i) => {
      const b = new Button(this, panel.left + 16 + tabW / 2 + i * (tabW + 6), tabsY, {
        width: tabW,
        height: 36,
        label: p.nickname,
        size: 'small',
        selected: p.id === profile?.id,
        onPress: () => {
          getSfx().play('tap');
          this.profileId = p.id;
          this.confirm = null;
          this.render();
        },
      });
      this.content.add(b);
    });

    const body: PanelBox = { ...panel, top: panel.top + 96, height: panel.bottom - 10 - (panel.top + 96) };
    if (!profile) {
      this.content.add(makeText(this, panel.cx, body.top + 40, 'No players yet. Back on the title screen you can add one.', 'body'));
    } else if (this.section === 'summary') {
      this.renderSummary(body, profile);
    } else {
      this.renderSettings(body, profile, profiles.length);
    }
    if (this.confirm) this.renderConfirm();
  }

  private renderSummary(body: PanelBox, profile: Profile): void {
    const s: ProfileSummary = summarise(profile, new Date());
    const left = body.left + 16;
    const wrapWidth = body.width - 32;
    let y = body.top;

    const headline =
      s.questions === 0
        ? `${profile.nickname} · ${getTrack(profile.track).label} · no questions answered in the last ${s.days} days. Minutes played: ${s.minutes}.`
        : `${profile.nickname} · ${getTrack(profile.track).label} · last ${s.days} days: ${s.questions} questions, ` +
          `${s.firstTryPct}% right first time, ${s.clues} clues used, ${s.minutes} minutes played.`;
    const head = makeText(this, left, y, headline, 'small', PALETTE.text, { fontSize: '13px', wordWrap: { width: wrapWidth }, align: 'left' }).setOrigin(0, 0);
    this.content.add(head);
    y += head.height + 8;

    if (s.skills.length > 0) {
      const cols = [0, Math.min(210, wrapWidth * 0.45), Math.min(290, wrapWidth * 0.62), Math.min(390, wrapWidth * 0.84)];
      const header = ['Skill', 'Questions', 'Right first time', 'Clues'];
      header.forEach((label, i) => {
        this.content.add(makeText(this, left + cols[i]!, y, label, 'small', PALETTE.panelShadow, { fontSize: '12px', fontStyle: 'bold' }).setOrigin(0, 0));
      });
      y += 18;
      const rows = s.skills.slice(0, MAX_SKILL_ROWS);
      for (const row of rows) {
        const cells = [row.skill, String(row.questions), `${row.rightFirstTime} of ${row.questions} (${row.firstTryPct}%)`, String(row.clues)];
        cells.forEach((cell, i) => {
          const t = makeText(this, left + cols[i]!, y, cell, 'small', PALETTE.text, { fontSize: '13px' }).setOrigin(0, 0);
          if (i === 0) fitText(t, cols[1]! - 8);
          this.content.add(t);
        });
        y += 17;
      }
      if (s.skills.length > rows.length) {
        this.content.add(makeText(this, left, y, `and ${s.skills.length - rows.length} more`, 'small', PALETTE.panelShadow, { fontSize: '12px' }).setOrigin(0, 0));
        y += 17;
      }
      y += 6;
    }

    this.content.add(
      makeText(this, left, y, `Suggested next: ${s.suggestion.text}`, 'small', PALETTE.text, {
        fontSize: '13px',
        fontStyle: 'bold',
        wordWrap: { width: wrapWidth },
        align: 'left',
      }).setOrigin(0, 0),
    );
  }

  private renderSettings(body: PanelBox, profile: Profile, profileCount: number): void {
    const store = getProfiles();
    const left = body.left + 16;
    const labelW = 150;
    let y = body.top + 20;

    this.content.add(makeText(this, left, y, 'Age band', 'small', PALETTE.text, { fontSize: '13px' }).setOrigin(0, 0.5));
    const trackW = Math.min(100, (body.width - 32 - labelW - 16) / 3);
    const trackButtons = new Map<number, Button>();
    TRACKS.forEach((track, i) => {
      const b = new Button(this, left + labelW + trackW / 2 + i * (trackW + 8), y, {
        width: trackW,
        height: 38,
        label: track.label,
        size: 'small',
        selected: profile.track === track.id,
        onPress: () => {
          getSfx().play('tap');
          store.update(profile.id, { track: track.id });
          for (const [id, button] of trackButtons) button.setSelected(id === track.id);
        },
      });
      trackButtons.set(track.id, b);
      this.content.add(b);
    });

    y += 46;
    this.content.add(makeText(this, left, y, 'Read-aloud voice', 'small', PALETTE.text, { fontSize: '13px' }).setOrigin(0, 0.5));
    const voice = new Button(this, left + labelW + 50, y, {
      width: 100,
      height: 38,
      label: isSpeechOn() ? 'On' : 'Off',
      size: 'small',
      selected: isSpeechOn(),
      onPress: () => {
        getSfx().play('tap');
        const on = toggleSpeech();
        voice.setSelected(on);
        voiceLabel.setText(on ? 'On' : 'Off');
      },
    });
    const voiceLabel = voice.getAt(1) as Phaser.GameObjects.Text;
    this.content.add(voice);
    this.content.add(
      makeText(this, left + labelW + 110, y, 'for everyone on this device', 'small', PALETTE.panelShadow, { fontSize: '12px' }).setOrigin(0, 0.5),
    );

    y += 46;
    this.content.add(makeText(this, left, y, profile.nickname, 'small', PALETTE.text, { fontSize: '13px' }).setOrigin(0, 0.5));
    const actionW = Math.min(150, (body.width - 32 - labelW - 8) / 2);
    this.content.add(
      new Button(this, left + labelW + actionW / 2, y, {
        width: actionW,
        height: 38,
        label: 'Reset progress',
        size: 'small',
        onPress: () => {
          getSfx().play('tap');
          this.confirm = { kind: 'reset', profileId: profile.id };
          this.render();
        },
      }),
    );
    if (profileCount > 1) {
      this.content.add(
        new Button(this, left + labelW + actionW * 1.5 + 8, y, {
          width: actionW,
          height: 38,
          label: 'Remove player',
          size: 'small',
          onPress: () => {
            getSfx().play('tap');
            this.confirm = { kind: 'remove', profileId: profile.id };
            this.render();
          },
        }),
      );
    }

    y += 34;
    this.content.add(
      makeText(this, left, y, PRIVACY_NOTE, 'small', PALETTE.panelShadow, {
        fontSize: '12px',
        wordWrap: { width: body.width - 32 },
        align: 'left',
      }).setOrigin(0, 0),
    );
  }

  private renderConfirm(): void {
    const confirm = this.confirm;
    if (!confirm) return;
    const store = getProfiles();
    const profile = store.get(confirm.profileId);
    if (!profile) {
      this.confirm = null;
      return;
    }
    const w = this.scale.width;
    const h = this.scale.height;
    const dim = this.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.45).setInteractive();
    this.content.add(dim);
    const box = drawPanel(this, w / 2, h / 2, Math.min(w - 40, 460), 190, 18);
    this.content.add(box.graphics);
    const message =
      confirm.kind === 'reset'
        ? `Reset ${profile.nickname}'s progress? Stars, shards and the learning log will be cleared. The name, age band and hero stay.`
        : `Remove ${profile.nickname}? Everything saved about this player will be deleted from this device.`;
    this.content.add(
      makeText(this, box.cx, box.top + 56, message, 'body', PALETTE.text, { fontSize: '16px', wordWrap: { width: box.width - 40 } }),
    );
    const bw = Math.min(180, (box.width - 56) / 2);
    this.content.add(
      new Button(this, box.cx - bw / 2 - 8, box.bottom - 40, {
        width: bw,
        height: 46,
        label: 'No',
        onPress: () => {
          getSfx().play('tap');
          this.confirm = null;
          this.render();
        },
      }),
    );
    this.content.add(
      new Button(this, box.cx + bw / 2 + 8, box.bottom - 40, {
        width: bw,
        height: 46,
        label: confirm.kind === 'reset' ? 'Yes, reset' : 'Yes, remove',
        fill: PALETTE.checkpointOn,
        onPress: () => {
          getSfx().play('tap');
          if (confirm.kind === 'reset') store.resetProgress(profile.id);
          else {
            store.remove(profile.id);
            this.profileId = store.active()?.id ?? null;
          }
          this.confirm = null;
          this.render();
        },
      }),
    );
  }
}
