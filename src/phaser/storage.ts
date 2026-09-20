import { MemoryStore, ProfileStore, type KeyValueStore } from '../game/profiles/store';

/**
 * localStorage behind the store's tiny key-value contract. Device-local only:
 * nothing is ever sent anywhere. Falls back to memory when storage is blocked
 * (private mode) so the game still works for the visit.
 */
class LocalStorageStore implements KeyValueStore {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Quota or private mode: the change still lives for this visit.
    }
  }
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  }
}

function storageUsable(): boolean {
  try {
    const probe = 'owen-alice-adventure.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function browserStore(): KeyValueStore {
  return storageUsable() ? new LocalStorageStore() : new MemoryStore();
}

let profiles: ProfileStore | null = null;

/** The one profile store for the whole game. */
export function getProfiles(): ProfileStore {
  if (!profiles) profiles = new ProfileStore(browserStore());
  return profiles;
}
