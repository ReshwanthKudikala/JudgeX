import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'judgex.theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyDomTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute(
      'content',
      resolved === 'dark' ? '#0F1117' : '#F4F5F7',
    );
  }
}

function readStoredPreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* ignore */
  }
  return 'system';
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const preference = readStoredPreference();
  const resolved = resolveTheme(preference);
  if (typeof document !== 'undefined') {
    applyDomTheme(resolved);
  }

  return {
    preference,
    resolved,
    setPreference: (next) => {
      const nextResolved = resolveTheme(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      applyDomTheme(nextResolved);
      set({ preference: next, resolved: nextResolved });
    },
    cyclePreference: () => {
      const order: ThemePreference[] = ['system', 'light', 'dark'];
      const current = get().preference;
      const idx = order.indexOf(current);
      const next = order[(idx + 1) % order.length];
      get().setPreference(next);
    },
  };
});

/** Keep resolved theme in sync when OS preference changes. */
export function subscribeSystemTheme() {
  if (typeof window === 'undefined') return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => {
    const { preference, setPreference } = useThemeStore.getState();
    if (preference === 'system') {
      setPreference('system');
    }
  };
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
