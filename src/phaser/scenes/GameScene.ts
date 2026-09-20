import Phaser from 'phaser';
import { QUESTIONS, SIM } from '../../game/config';
import { getHero, type HeroDef } from '../../game/heroes';
import { tipAt } from '../../game/level/loadLevel';
import type { Level } from '../../game/level/types';
import { loadFirstLevel } from '../../game/levels';
import type { SimEvent } from '../../game/sim/events';
import { createSimState, runSpeedAt, stepSim, type SimState, type SimWorld } from '../../game/sim/heroSim';
import { getTrack, type Track } from '../../game/tracks';
import { cameraScrollX, groundScreenY } from '../../game/viewport';
import { JumpInput } from '../input/JumpInput';
import { getSession } from '../session';
import { getSfx } from '../sfx';
import { speak, stopSpeaking } from '../speech';
import { Hud } from '../ui/Hud';
import { QuestionBanner } from '../ui/QuestionBanner';
import { TipStrip } from '../ui/TipStrip';
import { BubbleField } from '../views/BubbleView';
import { burst } from '../views/Burst';
import { CloudView } from '../views/CloudView';
import { GateView } from '../views/GateView';
import { HeroView } from '../views/HeroView';
import { LevelView } from '../views/LevelView';
import { Parallax } from '../views/Parallax';
import { ShardField } from '../views/ShardView';
import { SidekickView } from '../views/SidekickView';
import { StarField } from '../views/StarView';
import { SCENES, type ResultData } from './keys';

/**
 * The playable level. The scene owns no game rules: every frame it reads the
 * one-button input, steps the headless simulation in fixed steps, and mirrors
 * the resulting state and events onto the views and the sound synth.
 */
export class GameScene extends Phaser.Scene {
  private level!: Level;
  private track!: Track;
  private hero!: HeroDef;
  private world!: SimWorld;
  private state!: SimState;
  private accumulator = 0;

  private input$!: JumpInput;
  private parallax!: Parallax;
  private levelView!: LevelView;
  private starField!: StarField;
  private shardField!: ShardField;
  private clouds = new Map<number, CloudView>();
  private heroView!: HeroView;
  private sidekick!: SidekickView;
  private hud!: Hud;
  private tips!: TipStrip;
  private banner!: QuestionBanner;
  private bubbles!: BubbleField;
  private gate!: GateView;
  private ending = false;

  constructor() {
    super(SCENES.game);
  }

  create(): void {
    const session = getSession();
    this.level = loadFirstLevel();
    this.track = getTrack(session.track);
    this.hero = getHero(session.hero);
    this.world = { level: this.level, track: this.track, hero: this.hero, seed: Math.floor(Math.random() * 0xffffffff) };
    this.state = createSimState(this.world);
    this.accumulator = 0;
    this.ending = false;
    this.clouds.clear();

    this.parallax = new Parallax(this);
    this.levelView = new LevelView(this, this.level);
    this.starField = new StarField(this, this.level.stars);
    this.shardField = new ShardField(this, this.level.shards);
    for (const c of this.level.clouds) this.clouds.set(c.id, new CloudView(this, c));
    this.heroView = new HeroView(this, this.hero);
    this.sidekick = new SidekickView(this, this.hero);
    this.sidekick.teleport(this.state.x, 0);
    this.hud = new Hud(this, this.level.shards.length, () => this.scene.start(SCENES.title));
    this.tips = new TipStrip(this);
    this.banner = new QuestionBanner(this);
    this.bubbles = new BubbleField(this);
    this.gate = new GateView(this);
    this.input$ = new JumpInput(this);
    this.levelView.reachCheckpoint(0);

    this.cameras.main.setBackgroundColor(0x7ec8f2);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
      stopSpeaking();
    });
    this.updateCamera();
    this.heroView.sync(this.state, this.track.runSpeed, 0);
  }

  private onResize(): void {
    this.parallax.layout();
    this.banner.layout();
    this.hud.setBannerHeight(this.banner.height);
    this.hud.layout();
    this.tips.layout();
    this.updateCamera();
  }

  override update(_time: number, deltaMs: number): void {
    if (this.ending) return;
    const dt = Math.min(deltaMs / 1000, 0.25);
    const held = this.input$.read();

    // Fixed-step simulation.
    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= SIM.fixedDt && steps < SIM.maxStepsPerFrame) {
      const events = stepSim(this.world, this.state, { held }, SIM.fixedDt);
      for (const e of events) this.onEvent(e);
      this.accumulator -= SIM.fixedDt;
      steps++;
    }
    if (steps === SIM.maxStepsPerFrame) this.accumulator = 0;

    // Mirror state onto the views.
    const s = this.state;
    this.heroView.sync(s, runSpeedAt(this.world, s), dt);
    this.sidekick.sync(s.t, s.x, s.y, s.grounded, dt);
    for (const view of this.clouds.values()) view.sync(s.t);
    this.updateCamera();
    this.tips.show(s.finished ? null : tipAt(this.level, s.x, this.hero.airTip));
  }

  private updateCamera(): void {
    const cam = this.cameras.main;
    cam.scrollX = cameraScrollX(this.state.x, this.scale.width);
    cam.scrollY = -groundScreenY(this.scale.height);
    this.parallax.update(cam.scrollX);
  }

  private onEvent(e: SimEvent): void {
    const sfx = getSfx();
    switch (e.type) {
      case 'jump':
        sfx.play('jump');
        this.heroView.onJump();
        break;
      case 'land':
        this.heroView.onLand();
        break;
      case 'dash':
        sfx.play('dash');
        break;
      case 'floatStart':
        sfx.play('float');
        break;
      case 'star':
        sfx.star(e.streak);
        this.starField.collect(e.id);
        this.hud.setStars(this.state.starCount);
        break;
      case 'shard':
        sfx.play('shard');
        this.shardField.collect(e.id);
        this.hud.setShards(this.state.shardCount, this.level.shards.length);
        break;
      case 'stomp':
      case 'pop': {
        sfx.play('stomp');
        const view = this.clouds.get(e.cloudId);
        if (view) {
          burst(this, view.x, view.y, this.hero.popBurst);
          view.destroy();
          this.clouds.delete(e.cloudId);
        }
        break;
      }
      case 'bump':
        this.cameras.main.shake(120, 0.004);
        break;
      case 'pitBounce':
        sfx.play('pitBounce');
        this.heroView.onLand();
        break;
      case 'respawn':
        sfx.play('respawn');
        this.sidekick.teleport(this.state.x, this.state.y);
        break;
      case 'checkpoint':
        this.levelView.reachCheckpoint(e.id);
        break;
      case 'questionStart':
        // The run never stops: the banner and bubbles simply appear ahead.
        this.banner.show(e.question, e.attempt, this.hero.sidekickName, e.locks);
        this.hud.setBannerHeight(this.banner.height);
        this.bubbles.spawn(e.bubbles);
        if (e.attempt === 0) speak(e.question.text);
        else speak(`${this.hero.sidekickName} has a clue. ${e.question.clue.kind === 'text' ? e.question.clue.text : ''}`);
        break;
      case 'bubbleGrab':
        sfx.play(e.correct ? 'lockOpen' : 'wrong');
        this.bubbles.grab(e.bubbleId, e.correct);
        break;
      case 'questionMissed':
        this.bubbles.vanish();
        break;
      case 'lockOpen':
        this.banner.openLock(e.locks);
        break;
      case 'gateOpen':
        sfx.play('gateOpen');
        this.banner.hide();
        this.hud.setBannerHeight(0);
        this.gate.place(e.gateX, e.crystalX);
        break;
      case 'finish':
        this.finish();
        break;
    }
  }

  private finish(): void {
    this.ending = true;
    getSfx().play('finish');
    this.gate.collect();
    const L = this.state.learning;
    const data: ResultData = {
      levelName: this.level.name,
      finished: true,
      shardsFound: this.state.shardCount,
      shardsTotal: this.level.shards.length,
      starsCollected: this.state.starCount,
      starsTotal: this.level.stars.length,
      gateOpened: L.locks >= QUESTIONS.locks,
      questionsAsked: L.asked,
      rightFirstTime: L.rightFirstTime,
      cluesUsed: L.cluesUsed,
      respawns: this.state.respawns,
      skills: [...L.skills],
    };
    this.cameras.main.fadeOut(600, 255, 255, 255);
    this.time.delayedCall(700, () => this.scene.start(SCENES.result, data));
  }
}
