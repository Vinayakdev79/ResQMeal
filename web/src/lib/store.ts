import type { AppState } from './types';

/**
 * Key for the domain-data snapshot. Version 2 dropped the seeded demo users
 * (and their plaintext passwords) from the snapshot, so the v1 key is removed.
 */
const STORAGE_KEY = 'resqmeal.v2';
const LEGACY_STORAGE_KEY = 'resqmeal.v1';

/** Empty domain state. No users, donations, requests or testimonials are seeded. */
export function seedState(): AppState {
  return {
    users: [],
    events: [],
    donations: [],
    claims: [],
    timeline: [],
    disputes: [],
    funding: [],
    sponsorPrograms: [],
  };
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Persist state to localStorage. No-op when storage is unavailable. */
export function saveState(state: AppState): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage blocked: keep running in memory.
  }
}

/**
 * Load persisted state. If nothing is stored, or parsing fails, returns the
 * empty state and saves it. Without storage, returns the empty state in memory.
 */
export function loadState(): AppState {
  const storage = getStorage();
  if (!storage) return seedState();
  try {
    storage.removeItem(LEGACY_STORAGE_KEY);
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as AppState).users)) {
        return parsed as AppState;
      }
    }
  } catch {
    // Fall through to reset on corrupt data.
  }
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

/** Discard stored domain state, reset to the empty state, and persist it. */
export function resetDemo(): AppState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}
