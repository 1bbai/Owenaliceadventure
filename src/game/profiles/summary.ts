/**
 * The grown-ups summary: plain numbers for the last few days of one profile,
 * per skill, plus a suggested next skill. Pure functions over the profile's
 * logs so they are tested headlessly.
 */
import { PROFILES } from '../config';
import { SKILL_NAMES } from '../learning/questions';
import { getTrack, type TrackId } from '../tracks';
import type { Profile } from './types';

export interface SkillSummary {
  skill: string;
  questions: number;
  rightFirstTime: number;
  /** 0 to 100, rounded. */
  firstTryPct: number;
  /** Clue retries added up. */
  clues: number;
}

export type SuggestionReason = 'start' | 'moreData' | 'practise' | 'stepUp' | 'top';

export interface Suggestion {
  skill: string;
  reason: SuggestionReason;
  /** One plain sentence for the grown-ups corner. */
  text: string;
}

export interface ProfileSummary {
  days: number;
  questions: number;
  rightFirstTime: number;
  /** Null when no question was answered in the window. */
  firstTryPct: number | null;
  clues: number;
  /** Rounded to whole minutes. */
  minutes: number;
  /** Most practised first, then alphabetical. */
  skills: SkillSummary[];
  suggestion: Suggestion;
}

/** The window is the last `days` days up to and including `now`. */
export function windowStart(now: Date, days: number): number {
  return now.getTime() - days * 24 * 60 * 60 * 1000;
}

export function inWindow(at: string, now: Date, days: number): boolean {
  const t = Date.parse(at);
  return !Number.isNaN(t) && t >= windowStart(now, days) && t <= now.getTime();
}

export function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((100 * part) / whole) : 0;
}

/** Per-skill counts from log entries (already filtered to the window). */
export function summariseSkills(entries: readonly Profile['progress']['questions'][number][]): SkillSummary[] {
  const bySkill = new Map<string, SkillSummary>();
  for (const e of entries) {
    const s = bySkill.get(e.skill) ?? { skill: e.skill, questions: 0, rightFirstTime: 0, firstTryPct: 0, clues: 0 };
    s.questions += 1;
    if (e.firstTry) s.rightFirstTime += 1;
    s.clues += e.clues;
    bySkill.set(e.skill, s);
  }
  const out = [...bySkill.values()];
  for (const s of out) s.firstTryPct = pct(s.rightFirstTime, s.questions);
  return out.sort((a, b) => b.questions - a.questions || a.skill.localeCompare(b.skill));
}

/**
 * Which skill to point a grown-up at next, from this track's ladder and the
 * week's results. A skill "has enough" once it reaches
 * PROFILES.suggestMinQuestions questions; it is "going well" at or above
 * PROFILES.suggestSecurePct right first time.
 *
 * 1. Nothing practised: start with the track's first skill.
 * 2. Practised, but no skill has enough questions yet: play more of the most practised one.
 * 3. Any skill with enough questions below the mark: practise the weakest again.
 * 4. Otherwise the step above the highest skill going well; at the top of the
 *    ladder, keep going (and the next age band is ready when they are).
 */
export function suggestNextSkill(track: TrackId, skills: readonly SkillSummary[]): Suggestion {
  const ladder = SKILL_NAMES[track]!;
  if (skills.length === 0) {
    const skill = ladder[0]!;
    return { skill, reason: 'start', text: `Start with ${skill}: it comes first on this age band.` };
  }
  const judged = skills.filter((s) => s.questions >= PROFILES.suggestMinQuestions);
  if (judged.length === 0) {
    const skill = skills[0]!.skill;
    return { skill, reason: 'moreData', text: `Play a few more levels of ${skill} to see how it is going.` };
  }
  const shaky = judged.filter((s) => s.firstTryPct < PROFILES.suggestSecurePct).sort((a, b) => a.firstTryPct - b.firstTryPct);
  if (shaky.length > 0) {
    const s = shaky[0]!;
    return { skill: s.skill, reason: 'practise', text: `Practise ${s.skill} again: ${s.firstTryPct}% right first time this week.` };
  }
  const solid = judged.map((s) => ladder.indexOf(s.skill)).filter((i) => i >= 0);
  const highest = solid.length > 0 ? Math.max(...solid) : -1;
  const next = ladder[highest + 1];
  if (next !== undefined) {
    return { skill: next, reason: 'stepUp', text: `Ready for ${next}: the step after ${ladder[highest] ?? judged[0]!.skill} is going well.` };
  }
  const top = ladder[ladder.length - 1]!;
  const nextTrack = track < 2 ? getTrack((track + 1) as TrackId) : null;
  const tail = nextTrack ? ` The ${nextTrack.label} band is ready when they are.` : ' Keep playing for practice.';
  return { skill: top, reason: 'top', text: `${top} is going well.${tail}` };
}

/** The whole summary for one profile over the last `days` days. */
export function summarise(profile: Profile, now: Date, days: number = PROFILES.summaryDays): ProfileSummary {
  const questions = profile.progress.questions.filter((q) => inWindow(q.at, now, days));
  const play = profile.progress.play.filter((p) => inWindow(p.at, now, days));
  const skills = summariseSkills(questions);
  const rightFirstTime = questions.filter((q) => q.firstTry).length;
  const seconds = play.reduce((sum, p) => sum + p.seconds, 0);
  return {
    days,
    questions: questions.length,
    rightFirstTime,
    firstTryPct: questions.length > 0 ? pct(rightFirstTime, questions.length) : null,
    clues: questions.reduce((sum, q) => sum + q.clues, 0),
    minutes: Math.round(seconds / 60),
    skills,
    suggestion: suggestNextSkill(profile.track, skills),
  };
}
