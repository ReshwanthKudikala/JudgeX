const AUTH_PERSIST_KEY = 'judgex.auth';
const REMEMBER_KEY = 'judgex.auth.remember';

export type AuthPersistStorage = {
  getItem: (name: string) => string | null;
  setItem: (name: string, value: string) => void;
  removeItem: (name: string) => void;
};

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}

function safeRemove(storage: Storage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getRememberMePreference(): boolean {
  const raw = safeGet(localStorage, REMEMBER_KEY);
  // Default to remembered sessions (LeetCode-like “stay signed in”).
  if (raw === null) return true;
  return raw === '1';
}

export function setRememberMePreference(remember: boolean): void {
  safeSet(localStorage, REMEMBER_KEY, remember ? '1' : '0');
}

/**
 * Zustand persist storage that honors Remember Me:
 * - remember=true  → localStorage (survives browser restart)
 * - remember=false → sessionStorage (cleared when the tab/window closes)
 */
export const authPersistStorage: AuthPersistStorage = {
  getItem: (name) =>
    safeGet(localStorage, name) ?? safeGet(sessionStorage, name),

  setItem: (name, value) => {
    const remember = getRememberMePreference();
    if (remember) {
      safeSet(localStorage, name, value);
      safeRemove(sessionStorage, name);
    } else {
      safeSet(sessionStorage, name, value);
      safeRemove(localStorage, name);
    }
  },

  removeItem: (name) => {
    safeRemove(localStorage, name);
    safeRemove(sessionStorage, name);
  },
};

export { AUTH_PERSIST_KEY };
