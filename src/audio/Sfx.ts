/**
 * Synthesised sound effects with the Web Audio API. No audio files yet.
 * The AudioContext is created lazily on the first user gesture (browsers require that).
 */
export type SfxName =
  | 'jump'
  | 'dash'
  | 'float'
  | 'shard'
  | 'stomp'
  | 'respawn'
  | 'tap'
  | 'pitBounce'
  | 'finish'
  | 'lockOpen'
  | 'wrong'
  | 'gateOpen';

type Wave = OscillatorType;

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _enabled = true;

  constructor(enabled = true) {
    this._enabled = enabled;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    if (on) this.unlock();
  }

  /** Call from a user gesture so the browser lets audio start. Safe to call often. */
  unlock(): void {
    if (!this._enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private tone(
    freq: number,
    duration: number,
    opts: { wave?: Wave; to?: number; gain?: number; delay?: number; attack?: number } = {},
  ): void {
    if (!this._enabled || !this.ctx || !this.master) return;
    const { wave = 'sine', to = freq, gain = 1, delay = 0, attack = 0.005 } = opts;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(env).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  private noise(duration: number, gain = 0.4, delay = 0): void {
    if (!this._enabled || !this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const env = this.ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.master);
    src.start(t0);
  }

  play(name: SfxName): void {
    this.unlock();
    switch (name) {
      case 'jump':
        this.tone(330, 0.16, { wave: 'square', to: 660, gain: 0.5 });
        break;
      case 'dash':
        this.tone(520, 0.2, { wave: 'sawtooth', to: 180, gain: 0.35 });
        this.noise(0.12, 0.15);
        break;
      case 'float':
        this.tone(660, 0.35, { wave: 'sine', to: 520, gain: 0.25 });
        break;
      case 'shard':
        this.tone(880, 0.25, { wave: 'triangle', gain: 0.5 });
        this.tone(1320, 0.25, { wave: 'triangle', gain: 0.4, delay: 0.1 });
        this.tone(1760, 0.4, { wave: 'sine', gain: 0.4, delay: 0.2 });
        break;
      case 'stomp':
        this.noise(0.18, 0.5);
        this.tone(240, 0.18, { wave: 'square', to: 90, gain: 0.35 });
        this.tone(700, 0.1, { wave: 'sine', to: 1100, gain: 0.25, delay: 0.05 });
        break;
      case 'respawn':
        this.tone(440, 0.12, { wave: 'triangle', gain: 0.35 });
        this.tone(550, 0.12, { wave: 'triangle', gain: 0.35, delay: 0.12 });
        this.tone(660, 0.2, { wave: 'triangle', gain: 0.35, delay: 0.24 });
        break;
      case 'pitBounce':
        this.tone(200, 0.25, { wave: 'sine', to: 500, gain: 0.4 });
        break;
      case 'tap':
        this.tone(600, 0.06, { wave: 'sine', gain: 0.25 });
        break;
      case 'finish':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, { wave: 'triangle', gain: 0.4, delay: i * 0.12 }));
        break;
      case 'lockOpen':
        // A lock clicks open, then a rising chime with a sparkle on top.
        this.tone(300, 0.05, { wave: 'square', gain: 0.2 });
        [660, 880, 1320].forEach((f, i) => this.tone(f, 0.22, { wave: 'triangle', gain: 0.38, delay: 0.05 + i * 0.09 }));
        this.tone(2640, 0.3, { wave: 'sine', to: 3520, gain: 0.12, delay: 0.3 });
        break;
      case 'wrong':
        // Soft and friendly: a gentle "hmm", never a buzzer.
        this.tone(330, 0.16, { wave: 'sine', to: 290, gain: 0.22 });
        this.tone(290, 0.18, { wave: 'sine', to: 260, gain: 0.18, delay: 0.14 });
        break;
      case 'gateOpen':
        this.noise(0.3, 0.12);
        this.tone(220, 0.9, { wave: 'triangle', to: 880, gain: 0.3 });
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, { wave: 'triangle', gain: 0.35, delay: 0.5 + i * 0.1 }));
        break;
    }
  }

  /** Star pickup: the pitch rises with the streak. */
  star(streak: number): void {
    this.unlock();
    const base = 660;
    const freq = base * Math.pow(1.122, Math.max(0, streak - 1)); // two semitones per streak step
    this.tone(freq, 0.12, { wave: 'triangle', gain: 0.4 });
    this.tone(freq * 1.5, 0.1, { wave: 'sine', gain: 0.2, delay: 0.04 });
  }
}
