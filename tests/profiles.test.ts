import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/game/config';
import {
  cleanNickname,
  DEFAULT_NICKNAME,
  MemoryStore,
  parseProfilesData,
  ProfileLimitError,
  PROFILES_KEY,
  ProfileStore,
} from '../src/game/profiles/store';

const T0 = new Date('2026-09-20T10:00:00.000Z');

function makeStore(kv = new MemoryStore()) {
  let n = 0;
  let clock = T0.getTime();
  const store = new ProfileStore(kv, {
    now: () => new Date(clock),
    newId: () => `id${++n}`,
  });
  return { store, kv, advance: (ms: number) => (clock += ms) };
}

describe('profile store: profiles', () => {
  it('starts empty and has no active profile', () => {
    const { store } = makeStore();
    expect(store.list()).toEqual([]);
    expect(store.active()).toBeNull();
    expect(store.count()).toBe(0);
    expect(store.isFull()).toBe(false);
  });

  it('creates a profile with a clean nickname, empty progress, and makes it active', () => {
    const { store } = makeStore();
    const p = store.create({ nickname: '  owen   fan  ', track: 1, hero: 'owen' });
    expect(p).toMatchObject({ id: 'id1', nickname: 'owen fan', track: 1, hero: 'owen', createdAt: T0.toISOString() });
    expect(p.progress).toEqual({ levels: {}, totalStars: 0, questions: [], play: [] });
    expect(store.active()?.id).toBe('id1');
  });

  it('allows at most four profiles', () => {
    const { store } = makeStore();
    for (let i = 0; i < PROFILES.max; i++) store.create({ nickname: `Kid ${i}`, track: 0, hero: 'alice' });
    expect(store.isFull()).toBe(true);
    expect(() => store.create({ nickname: 'One more', track: 0, hero: 'alice' })).toThrow(ProfileLimitError);
    expect(store.count()).toBe(PROFILES.max);
  });

  it('switches the active profile and falls back to the first when the active one is removed', () => {
    const { store } = makeStore();
    store.create({ nickname: 'A', track: 0, hero: 'alice' });
    const b = store.create({ nickname: 'B', track: 2, hero: 'owen' });
    expect(store.active()?.nickname).toBe('B');
    store.setActive('id1');
    expect(store.active()?.nickname).toBe('A');
    store.setActive(b.id);
    store.remove(b.id);
    expect(store.list().map((p) => p.nickname)).toEqual(['A']);
    expect(store.active()?.nickname).toBe('A');
    store.remove('id1');
    expect(store.active()).toBeNull();
    expect(() => store.setActive('nope')).toThrow(/Unknown profile/);
  });

  it('updates the nickname, age band and hero without touching progress', () => {
    const { store } = makeStore();
    const p = store.create({ nickname: 'A', track: 0, hero: 'alice' });
    store.recordRun(p.id, { levelId: 'w1l1', stars: 2, starsCollected: 50, shardIds: [1] });
    store.update(p.id, { track: 2 });
    store.update(p.id, { hero: 'owen', nickname: '' });
    const after = store.get(p.id)!;
    expect(after.track).toBe(2);
    expect(after.hero).toBe('owen');
    expect(after.nickname).toBe(DEFAULT_NICKNAME);
    expect(after.progress.totalStars).toBe(50);
  });

  it('resets progress but keeps the profile', () => {
    const { store } = makeStore();
    const p = store.create({ nickname: 'A', track: 1, hero: 'owen' });
    store.recordRun(p.id, { levelId: 'w1l1', stars: 3, starsCollected: 120, shardIds: [0, 1, 2] });
    store.recordQuestion(p.id, { skill: 'Adding within 10', firstTry: true, clues: 0 });
    store.recordPlay(p.id, 90);
    store.resetProgress(p.id);
    const after = store.get(p.id)!;
    expect(after.nickname).toBe('A');
    expect(after.track).toBe(1);
    expect(after.progress).toEqual({ levels: {}, totalStars: 0, questions: [], play: [] });
  });
});

describe('profile store: progress', () => {
  it('keeps the best stars per level, every shard ever found, and the running star total', () => {
    const { store } = makeStore();
    const p = store.create({ nickname: 'A', track: 0, hero: 'alice' });
    store.recordRun(p.id, { levelId: 'w1l1', stars: 2, starsCollected: 80, shardIds: [2] });
    store.recordRun(p.id, { levelId: 'w1l1', stars: 1, starsCollected: 100, shardIds: [0, 2] });
    store.recordRun(p.id, { levelId: 'w1l1', stars: 3, starsCollected: 60, shardIds: [] });
    store.recordRun(p.id, { levelId: 'w1l2', stars: 1, starsCollected: 10, shardIds: [1] });
    const { levels, totalStars } = store.get(p.id)!.progress;
    expect(levels.w1l1).toEqual({ bestStars: 3, bestCollected: 100, shards: [0, 2] });
    expect(levels.w1l2).toEqual({ bestStars: 1, bestCollected: 10, shards: [1] });
    expect(totalStars).toBe(250);
  });

  it('logs question results with the date and rolls the log at the limit', () => {
    const { store, advance } = makeStore();
    const p = store.create({ nickname: 'A', track: 1, hero: 'owen' });
    store.recordQuestion(p.id, { skill: 'Adding within 10', firstTry: true, clues: 0 });
    advance(60_000);
    store.recordQuestion(p.id, { skill: 'Adding within 20', firstTry: false, clues: 2 });
    const log = store.get(p.id)!.progress.questions;
    expect(log).toEqual([
      { skill: 'Adding within 10', firstTry: true, clues: 0, at: '2026-09-20T10:00:00.000Z' },
      { skill: 'Adding within 20', firstTry: false, clues: 2, at: '2026-09-20T10:01:00.000Z' },
    ]);
    for (let i = 0; i < PROFILES.questionLog + 5; i++) store.recordQuestion(p.id, { skill: `s${i}`, firstTry: true, clues: 0 });
    const rolled = store.get(p.id)!.progress.questions;
    expect(rolled).toHaveLength(PROFILES.questionLog);
    expect(rolled[0]!.skill).toBe('s5');
    expect(rolled[rolled.length - 1]!.skill).toBe(`s${PROFILES.questionLog + 4}`);
  });

  it('logs play time, ignores empty durations, and rolls the log at the limit', () => {
    const { store } = makeStore();
    const p = store.create({ nickname: 'A', track: 1, hero: 'owen' });
    store.recordPlay(p.id, 0);
    store.recordPlay(p.id, -5);
    store.recordPlay(p.id, Number.NaN);
    store.recordPlay(p.id, 42.5);
    expect(store.get(p.id)!.progress.play).toEqual([{ seconds: 42.5, at: T0.toISOString() }]);
    for (let i = 0; i < PROFILES.playLog + 3; i++) store.recordPlay(p.id, 1);
    expect(store.get(p.id)!.progress.play).toHaveLength(PROFILES.playLog);
  });

  it('refuses to record against an unknown profile', () => {
    const { store } = makeStore();
    expect(() => store.recordPlay('ghost', 10)).toThrow(/Unknown profile/);
    expect(() => store.recordQuestion('ghost', { skill: 'x', firstTry: true, clues: 0 })).toThrow(/Unknown profile/);
  });
});

describe('profile store: persistence', () => {
  it('writes every change through to the key-value store and reads it back in a new store', () => {
    const kv = new MemoryStore();
    const { store } = makeStore(kv);
    const p = store.create({ nickname: 'Alice fan', track: 0, hero: 'alice' });
    store.create({ nickname: 'Cousin', track: 2, hero: 'owen' });
    store.setActive(p.id);
    store.recordRun(p.id, { levelId: 'w1l1', stars: 2, starsCollected: 30, shardIds: [1] });
    store.recordQuestion(p.id, { skill: 'Counting to 5', firstTry: false, clues: 1 });
    store.recordPlay(p.id, 75);

    const raw = kv.get(PROFILES_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!).version).toBe(1);
    expect(raw).not.toMatch(/http|@/); // nothing but the child's own choices and numbers

    const again = new ProfileStore(kv);
    expect(again.list().map((q) => q.nickname)).toEqual(['Alice fan', 'Cousin']);
    expect(again.active()?.id).toBe(p.id);
    expect(again.get(p.id)!.progress).toEqual(store.get(p.id)!.progress);
  });

  it('survives corrupt, foreign and partly broken data', () => {
    expect(parseProfilesData(null)).toEqual({ version: 1, activeId: null, profiles: [] });
    expect(parseProfilesData('not json')).toEqual({ version: 1, activeId: null, profiles: [] });
    expect(parseProfilesData('{"version":2,"profiles":[]}')).toEqual({ version: 1, activeId: null, profiles: [] });
    expect(parseProfilesData('[]')).toEqual({ version: 1, activeId: null, profiles: [] });

    const messy = JSON.stringify({
      version: 1,
      activeId: 'missing',
      profiles: [
        { id: 'ok', nickname: 'Ok', track: 1, hero: 'owen', createdAt: 'bad date', progress: { totalStars: -3, questions: [{ skill: 'a', firstTry: 'yes', clues: 2, at: T0.toISOString() }, { skill: '', at: T0.toISOString() }, 'junk'], play: [{ seconds: 0, at: T0.toISOString() }, { seconds: 30, at: T0.toISOString() }], levels: { w1l1: { bestStars: 9, bestCollected: 4, shards: [2, 2, -1, 'x'] }, broken: 5 } } },
        { id: 'ok', nickname: 'Duplicate', track: 1, hero: 'owen' },
        { id: 'bad-track', nickname: 'X', track: 5, hero: 'owen' },
        { id: 'bad-hero', nickname: 'X', track: 0, hero: 'bob' },
        { id: 'bare', track: 2, hero: 'alice' },
        null,
      ],
    });
    const data = parseProfilesData(messy, T0);
    expect(data.profiles.map((p) => p.id)).toEqual(['ok', 'bare']);
    expect(data.activeId).toBe('ok');
    const ok = data.profiles[0]!;
    expect(ok.createdAt).toBe(T0.toISOString());
    expect(ok.progress.totalStars).toBe(0);
    expect(ok.progress.questions).toEqual([{ skill: 'a', firstTry: false, clues: 2, at: T0.toISOString() }]);
    expect(ok.progress.play).toEqual([{ seconds: 30, at: T0.toISOString() }]);
    expect(ok.progress.levels).toEqual({ w1l1: { bestStars: 3, bestCollected: 4, shards: [2] } });
    expect(data.profiles[1]!.nickname).toBe(DEFAULT_NICKNAME);
  });

  it('never loads more than the maximum number of profiles', () => {
    const many = JSON.stringify({
      version: 1,
      activeId: 'p5',
      profiles: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, nickname: `P${i}`, track: 0, hero: 'alice' })),
    });
    const data = parseProfilesData(many, T0);
    expect(data.profiles).toHaveLength(PROFILES.max);
    expect(data.activeId).toBe('p0');
  });

  it('reload drops the cached copy', () => {
    const kv = new MemoryStore();
    const { store } = makeStore(kv);
    store.create({ nickname: 'A', track: 0, hero: 'alice' });
    kv.set(PROFILES_KEY, JSON.stringify({ version: 1, activeId: null, profiles: [] }));
    expect(store.count()).toBe(1);
    store.reload();
    expect(store.count()).toBe(0);
  });
});

describe('cleanNickname', () => {
  it('trims, collapses spaces, cuts to the limit and never returns an empty name', () => {
    expect(cleanNickname('  Alice  ')).toBe('Alice');
    expect(cleanNickname('a   b')).toBe('a b');
    expect(cleanNickname('')).toBe(DEFAULT_NICKNAME);
    expect(cleanNickname('   ')).toBe(DEFAULT_NICKNAME);
    expect(cleanNickname('x'.repeat(40))).toHaveLength(PROFILES.nicknameMax);
    expect(cleanNickname('abcdefghijk lmn')).toBe('abcdefghijk');
  });
});
