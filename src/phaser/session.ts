/**
 * Device-wide settings: sound and the read-aloud voice. Kept in memory and
 * mirrored to localStorage (device-local only, never sent anywhere). Who is
 * playing, their age band and favourite hero live in the profile store
 * (`storage.ts`), not here.
 */
export interface Session {
  sound: boolean;
  /** Read each new question aloud with the browser's speech synthesis. */
  speech: boolean;
}

const KEY = 'owen-alice-adventure.session.v1';

const DEFAULTS: Session = { sound: true, speech: true };

let current: Session | null = null;

function read(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULTS.sound,
      speech: typeof parsed.speech === 'boolean' ? parsed.speech : DEFAULTS.speech,
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
