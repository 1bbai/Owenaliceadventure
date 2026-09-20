import { Sfx } from '../audio/Sfx';
import { getSession, updateSession } from './session';

let instance: Sfx | null = null;

/** One shared sound-effect synth for the whole game. */
export function getSfx(): Sfx {
  if (!instance) instance = new Sfx(getSession().sound);
  return instance;
}

export function toggleSound(): boolean {
  const sfx = getSfx();
  const on = !sfx.enabled;
  sfx.setEnabled(on);
  updateSession({ sound: on });
  if (on) sfx.play('tap');
  return on;
}
