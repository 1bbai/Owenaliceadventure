import type { HeroId } from '../game/heroes';
import type { TrackId } from '../game/tracks';

/**
 * Player choices for this visit. Kept in memory and mirrored to localStorage
 * (device-local only, never sent anywhere) so a child does not have to
 * re-pick their hero and age every time.
 */
export interface Session {
  hero: HeroId;
  track: TrackId;
  sound: boolean;
}

const KEY = 'owen-alice-adventure.session.v1';

const DEFAULTS: Session = { hero: 'alice', track: 0, sound: true };

let current: Session | null = null;

function read(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      hero: parsed.hero === 'owen' || parsed.hero === 'alice' ? parsed.hero : DEFAULTS.hero,
      track: parsed.track === 0 || parsed.track === 1 || parsed.track === 2 ? parsed.track : DEFAULTS.track,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function getSession(): Session {
  if (!current) current = read();
  return current;
}

export function updateSession(patch: Partial<Session>): Session {
  current = { ...getSession(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode or blocked storage: the choice still lives for this visit.
  }
  return current;
}
