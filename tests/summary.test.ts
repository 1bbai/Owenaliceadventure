import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/game/config';
import { SKILL_NAMES } from '../src/game/learning/questions';
import { inWindow, pct, suggestNextSkill, summarise, summariseSkills, type SkillSummary } from '../src/game/profiles/summary';
import type { LearningEntry, PlayEntry, Profile } from '../src/game/profiles/types';

const NOW = new Date('2026-09-20T18:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number, hours = 0): string {
  return new Date(NOW.getTime() - n * DAY - hours * 60 * 60 * 1000).toISOString();
}

function profile(questions: LearningEntry[] = [], play: PlayEntry[] = [], track: 0 | 1 | 2 = 1): Profile {
  return {
    id: 'p',
    nickname: 'Test',
    track,
    hero: 'owen',
    createdAt: daysAgo(30),
    progress: { levels: {}, totalStars: 0, questions, play },
  };
}

function q(skill: string, firstTry: boolean, clues: number, at: string): LearningEntry {
  return { skill, firstTry, clues, at };
}

function skill(name: string, questions: number, rightFirstTime: number, clues = 0): SkillSummary {
  return { skill: name, questions, rightFirstTime, firstTryPct: pct(rightFirstTime, questions), clues };
}

describe('window and percentages', () => {
  it('keeps entries from the last 7 days and drops older or future ones', () => {
    expect(inWindow(daysAgo(0), NOW, 7)).toBe(true);
    expect(inWindow(daysAgo(6, 23), NOW, 7)).toBe(true);
    expect(inWindow(daysAgo(7, 1), NOW, 7)).toBe(false);
    expect(inWindow(daysAgo(-1), NOW, 7)).toBe(false);
    expect(inWindow('garbage', NOW, 7)).toBe(false);
  });

  it('rounds percentages and treats zero questions as 0', () => {
    expect(pct(2, 3)).toBe(67);
    expect(pct(1, 3)).toBe(33);
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 5)).toBe(100);
  });
});

describe('summariseSkills', () => {
  it('counts questions, first tries and clues per skill, most practised first', () => {
    const out = summariseSkills([
      q('Adding within 20', true, 0, daysAgo(1)),
      q('Adding within 10', false, 2, daysAgo(1)),
      q('Adding within 10', true, 0, daysAgo(2)),
      q('Adding within 10', true, 0, daysAgo(3)),
      q('Taking away within 20', false, 1, daysAgo(1)),
    ]);
    expect(out).toEqual([
      skill('Adding within 10', 3, 2, 2),
      skill('Adding within 20', 1, 1, 0),
      skill('Taking away within 20', 1, 0, 1),
    ]);
  });
});

describe('summarise', () => {
  it('reports the last 7 days only: questions, first-time %, clues, minutes and skills', () => {
    const p = profile(
      [
        q('Adding within 10', true, 0, daysAgo(0)),
        q('Adding within 10', false, 1, daysAgo(2)),
        q('Adding within 20', true, 0, daysAgo(6)),
        q('Adding within 20', true, 0, daysAgo(9)), // too old
      ],
      [
        { seconds: 300, at: daysAgo(1) },
        { seconds: 330, at: daysAgo(5) },
        { seconds: 3000, at: daysAgo(8) }, // too old
      ],
    );
    const s = summarise(p, NOW);
    expect(s.days).toBe(PROFILES.summaryDays);
    expect(s.questions).toBe(3);
    expect(s.rightFirstTime).toBe(2);
    expect(s.firstTryPct).toBe(67);
    expect(s.clues).toBe(1);
    expect(s.minutes).toBe(11);
    expect(s.skills).toEqual([skill('Adding within 10', 2, 1, 1), skill('Adding within 20', 1, 1, 0)]);
    expect(s.suggestion.reason).toBe('moreData');
  });

  it('handles a profile with nothing in the window', () => {
    const s = summarise(profile([q('Adding within 10', true, 0, daysAgo(20))], [{ seconds: 600, at: daysAgo(20) }], 0), NOW);
    expect(s.questions).toBe(0);
    expect(s.firstTryPct).toBeNull();
    expect(s.clues).toBe(0);
    expect(s.minutes).toBe(0);
    expect(s.skills).toEqual([]);
    expect(s.suggestion).toEqual({ skill: 'Counting to 5', reason: 'start', text: expect.stringContaining('Start with Counting to 5') });
  });

  it('can use a different window length', () => {
    const p = profile([q('Counting to 5', true, 0, daysAgo(10))], [], 0);
    expect(summarise(p, NOW, 7).questions).toBe(0);
    expect(summarise(p, NOW, 30).questions).toBe(1);
  });
});

describe('suggestNextSkill', () => {
  const [add10, add20, sub20] = SKILL_NAMES[1]! as [string, string, string];

  it('starts at the bottom of the ladder when nothing was practised', () => {
    expect(suggestNextSkill(2, []).skill).toBe('Times tables 2 to 5');
    expect(suggestNextSkill(2, []).reason).toBe('start');
  });

  it('asks for more play before judging a skill with too few questions', () => {
    const s = suggestNextSkill(1, [skill(add20, 2, 0), skill(add10, 1, 1)]);
    expect(s).toMatchObject({ skill: add20, reason: 'moreData' });
  });

  it('points at the weakest judged skill when one is below the mark', () => {
    const s = suggestNextSkill(1, [skill(add10, 4, 4), skill(add20, 3, 1), skill(sub20, 3, 2)]);
    expect(s).toMatchObject({ skill: add20, reason: 'practise' });
    expect(s.text).toContain('33%');
  });

  it('steps up the ladder above the highest skill going well', () => {
    expect(suggestNextSkill(1, [skill(add10, 3, 3)])).toMatchObject({ skill: add20, reason: 'stepUp' });
    expect(suggestNextSkill(1, [skill(add10, 3, 3), skill(add20, 4, 3)])).toMatchObject({ skill: sub20, reason: 'stepUp' });
    // A shaky skill with too few questions does not block the step up.
    expect(suggestNextSkill(1, [skill(add10, 3, 3), skill(add20, 2, 0)])).toMatchObject({ skill: add20, reason: 'stepUp' });
  });

  it('treats exactly the secure percentage as going well', () => {
    const s = suggestNextSkill(0, [skill('Counting to 5', 10, 7)]);
    expect(s).toMatchObject({ skill: 'Counting to 8', reason: 'stepUp' });
  });

  it('at the top of the ladder keeps going and names the next age band', () => {
    const s = suggestNextSkill(1, [skill(sub20, 5, 5)]);
    expect(s).toMatchObject({ skill: sub20, reason: 'top' });
    expect(s.text).toContain('Age 8 to 9');
    const top = suggestNextSkill(2, [skill('Sharing equally', 5, 5)]);
    expect(top.reason).toBe('top');
    expect(top.text).not.toContain('Age');
  });

  it('ignores skills from another age band when placing the child on the ladder', () => {
    // Practised on track 0 last week, then the band was changed to track 1.
    const s = suggestNextSkill(1, [skill('Counting to 12', 6, 6)]);
    expect(s).toMatchObject({ skill: add10, reason: 'stepUp' });
  });
});
