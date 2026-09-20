import { speechText } from '../game/learning/questions';
import { getSession, updateSession } from './session';

/**
 * Text-to-speech for players who cannot read yet. Uses the browser's speech
 * synthesis when it exists; does nothing otherwise. Never fetches anything.
 */
export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance === 'function';
}

export function isSpeechOn(): boolean {
  return getSession().speech;
}

export function toggleSpeech(): boolean {
  const on = !isSpeechOn();
  updateSession({ speech: on });
  if (on) speak('Reading aloud is on.');
  else stopSpeaking();
  return on;
}

/** Reads text aloud, replacing anything still being read. Safe to call when speech is off or unsupported. */
export function speak(text: string): void {
  if (!isSpeechOn() || !speechAvailable()) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(speechText(text));
    utterance.lang = 'en';
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    synth.speak(utterance);
  } catch {
    // Speech is a bonus; the banner still shows the question.
  }
}

export function stopSpeaking(): void {
  if (!speechAvailable()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Nothing to stop.
  }
}
