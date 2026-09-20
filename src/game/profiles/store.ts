/**
 * Player profiles, saved on the device only. The store talks to a tiny
 * key-value interface so the backing storage (localStorage today) can be
 * swapped later without touching the rules or the screens. No accounts, no
 * network: nothing here ever leaves the device.
 */
import { PROFILES } from '../config';
import type { HeroId } from '../heroes';
import type { TrackId } from '../tracks';
import type { LearningEntry, LevelProgress, PlayEntry, Profile, ProfilesData, Progress, RunRecord } from './types';

/** The smallest storage contract the profiles need. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** In-memory storage for tests and for browsers with storage blocked. */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

export const PROFILES_KEY = 'owen-alice-adventure.profiles.v1';

export const DEFAULT_NICKNAME = 'Player';

export interface NewProfile {
  nickname: string;
  track: TrackId;
  hero: HeroId;
}

export interface ProfileStoreOptions {
  /** Clock, replaceable in tests. */
  now?: () => Date;
  /** Id generator, replaceable in tests. */
  newId?: () => string;
}

export class ProfileLimitError extends Error {
  constructor() {
    super(`At most ${PROFILES.max} players can share a device.`);
    this.name = 'ProfileLimitError';
  }
}

export function emptyProgress(): Progress {
  return { levels: {}, totalStars: 0, questions: [], play: [] };
}

/** Trims, collapses spaces and cuts a nickname to the limit; empty becomes the default name. */
export function cleanNickname(raw: string): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim().slice(0, PROFILES.nicknameMax).trim();
  return cleaned.length > 0 ? cleaned : DEFAULT_NICKNAME;
}

function isTrack(v: unknown): v is TrackId {
  return v === 0 || v === 1 || v === 2;
}

function isHero(v: unknown): v is HeroId {
  return v === 'owen' || v === 'alice';
}

function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}

function nonNegativeInt(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function sanitiseLevel(raw: unknown): LevelProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const shards = Array.isArray(r.shards) ? [...new Set(r.shards.filter((s): s is number => typeof s === 'number' && Number.isInteger(s) && s >= 0))] : [];
  return {
    bestStars: Math.min(3, nonNegativeInt(r.bestStars)),
    bestCollected: nonNegativeInt(r.bestCollected),
    shards: shards.sort((a, b) => a - b),
  };
}

function sanitiseQuestion(raw: unknown): LearningEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.skill !== 'string' || r.skill.length === 0 || !isIsoDate(r.at)) return null;
  return { skill: r.skill, firstTry: r.firstTry === true, clues: nonNegativeInt(r.clues), at: r.at };
}

function sanitisePlay(raw: unknown): PlayEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!isIsoDate(r.at)) return null;
  const seconds = typeof r.seconds === 'number' && Number.isFinite(r.seconds) && r.seconds > 0 ? r.seconds : 0;
  return seconds > 0 ? { seconds, at: r.at } : null;
}

function sanitiseProgress(raw: unknown): Progress {
  const out = emptyProgress();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (r.levels && typeof r.levels === 'object') {
    for (const [id, level] of Object.entries(r.levels as Record<string, unknown>)) {
      const clean = sanitiseLevel(level);
      if (clean) out.levels[id] = clean;
    }
  }
  out.totalStars = nonNegativeInt(r.totalStars);
  if (Array.isArray(r.questions)) {
    out.questions = r.questions.map(sanitiseQuestion).filter((q): q is LearningEntry => q !== null).slice(-PROFILES.questionLog);
  }
  if (Array.isArray(r.play)) {
    out.play = r.play.map(sanitisePlay).filter((p): p is PlayEntry => p !== null).slice(-PROFILES.playLog);
  }
  return out;
}

function sanitiseProfile(raw: unknown, fallbackDate: string): Profile | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || r.id.length === 0) return null;
  if (!isTrack(r.track) || !isHero(r.hero)) return null;
  return {
    id: r.id,
    nickname: cleanNickname(typeof r.nickname === 'string' ? r.nickname : ''),
    track: r.track,
    hero: r.hero,
    createdAt: isIsoDate(r.createdAt) ? r.createdAt : fallbackDate,
    progress: sanitiseProgress(r.progress),
  };
}

/**
 * Turns whatever is in storage into valid data. Anything missing, corrupt or
 * from an unknown version becomes an empty document rather than a crash;
 * broken profiles are dropped, broken entries inside a profile are skipped.
 */
export function parseProfilesData(raw: string | null, now: Date = new Date()): ProfilesData {
  const empty: ProfilesData = { version: 1, activeId: null, profiles: [] };
  if (!raw) return empty;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!parsed || typeof parsed !== 'object') return empty;
  const r = parsed as Record<string, unknown>;
  if (r.version !== 1 || !Array.isArray(r.profiles)) return empty;
  const seen = new Set<string>();
  const profiles: Profile[] = [];
  for (const item of r.profiles) {
    const p = sanitiseProfile(item, now.toISOString());
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    profiles.push(p);
    if (profiles.length === PROFILES.max) break;
  }
  const activeId = typeof r.activeId === 'string' && seen.has(r.activeId) ? r.activeId : (profiles[0]?.id ?? null);
  return { version: 1, activeId, profiles };
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The profile store. Every mutation is written straight through to the
 * key-value store; reads come from memory after the first load.
 */
export class ProfileStore {
  private data: ProfilesData | null = null;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(
    private readonly kv: KeyValueStore,
    opts: ProfileStoreOptions = {},
  ) {
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? randomId;
  }

  private load(): ProfilesData {
    if (!this.data) this.data = parseProfilesData(this.kv.get(PROFILES_KEY), this.now());
    return this.data;
  }

  private save(): void {
    if (!this.data) return;
    this.kv.set(PROFILES_KEY, JSON.stringify(this.data));
  }

  /** Drops the in-memory copy so the next read comes from storage again. */
  reload(): void {
    this.data = null;
  }

  list(): readonly Profile[] {
    return this.load().profiles;
  }

  count(): number {
    return this.load().profiles.length;
  }

  isFull(): boolean {
    return this.count() >= PROFILES.max;
  }

  get(id: string): Profile | null {
    return this.load().profiles.find((p) => p.id === id) ?? null;
  }

  private must(id: string): Profile {
    const p = this.get(id);
    if (!p) throw new Error(`Unknown profile ${id}`);
    return p;
  }

  /** The profile playing now; the first one when none was chosen; null when there are none. */
  active(): Profile | null {
    const d = this.load();
    const chosen = d.activeId ? d.profiles.find((p) => p.id === d.activeId) : undefined;
    return chosen ?? d.profiles[0] ?? null;
  }

  setActive(id: string): Profile {
    const p = this.must(id);
    this.load().activeId = id;
    this.save();
    return p;
  }

  /** Creates a profile and makes it the active one. Throws ProfileLimitError when the device is full. */
  create(input: NewProfile): Profile {
    const d = this.load();
    if (d.profiles.length >= PROFILES.max) throw new ProfileLimitError();
    let id = this.newId();
    while (d.profiles.some((p) => p.id === id)) id = this.newId();
    const profile: Profile = {
      id,
      nickname: cleanNickname(input.nickname),
      track: input.track,
      hero: input.hero,
      createdAt: this.now().toISOString(),
      progress: emptyProgress(),
    };
    d.profiles.push(profile);
    d.activeId = id;
    this.save();
    return profile;
  }

  /** Changes the nickname, age band or favourite hero. Progress is untouched. */
  update(id: string, patch: Partial<NewProfile>): Profile {
    const p = this.must(id);
    if (patch.nickname !== undefined) p.nickname = cleanNickname(patch.nickname);
    if (patch.track !== undefined) p.track = patch.track;
    if (patch.hero !== undefined) p.hero = patch.hero;
    this.save();
    return p;
  }

  /** Clears stars, shards and both logs; the name, age band and hero stay. */
  resetProgress(id: string): Profile {
    const p = this.must(id);
    p.progress = emptyProgress();
    this.save();
    return p;
  }

  remove(id: string): void {
    const d = this.load();
    this.must(id);
    d.profiles = d.profiles.filter((p) => p.id !== id);
    if (d.activeId === id) d.activeId = d.profiles[0]?.id ?? null;
    this.save();
  }

  /** A finished level: best stars per level, shards found (kept for good) and the running star total. */
  recordRun(id: string, run: RunRecord): Profile {
    const p = this.must(id);
    const level = p.progress.levels[run.levelId] ?? { bestStars: 0, bestCollected: 0, shards: [] };
    level.bestStars = Math.max(level.bestStars, Math.min(3, nonNegativeInt(run.stars)));
    level.bestCollected = Math.max(level.bestCollected, nonNegativeInt(run.starsCollected));
    level.shards = [...new Set([...level.shards, ...run.shardIds])].sort((a, b) => a - b);
    p.progress.levels[run.levelId] = level;
    p.progress.totalStars += nonNegativeInt(run.starsCollected);
    this.save();
    return p;
  }

  /** One answered question goes on the rolling learning log. */
  recordQuestion(id: string, entry: Omit<LearningEntry, 'at'> & { at?: string }): Profile {
    const p = this.must(id);
    const log = p.progress.questions;
    log.push({ skill: entry.skill, firstTry: entry.firstTry, clues: nonNegativeInt(entry.clues), at: entry.at ?? this.now().toISOString() });
    if (log.length > PROFILES.questionLog) log.splice(0, log.length - PROFILES.questionLog);
    this.save();
    return p;
  }

  /** Time spent playing, on the rolling play log. Zero or negative durations are ignored. */
  recordPlay(id: string, seconds: number, at?: string): Profile {
    const p = this.must(id);
    if (!(seconds > 0) || !Number.isFinite(seconds)) return p;
    const log = p.progress.play;
    log.push({ seconds, at: at ?? this.now().toISOString() });
    if (log.length > PROFILES.playLog) log.splice(0, log.length - PROFILES.playLog);
    this.save();
    return p;
  }
}
