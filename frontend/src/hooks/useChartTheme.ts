import { useThemeStore } from '@/store/theme.store';

/** Shared Recharts colors that follow the active theme. */
export function useChartTheme() {
  const resolved = useThemeStore((s) => s.resolved);
  const dark = resolved === 'dark';

  return {
    grid: dark ? '#2b2f36' : '#d8dce3',
    tick: dark ? '#8b949e' : '#6b7280',
    tooltip: {
      background: dark ? '#1a1d24' : '#ffffff',
      border: dark ? '#2b2f36' : '#d8dce3',
      color: dark ? '#f0f3f6' : '#111827',
    },
    difficulty: {
      easy: '#34d399',
      medium: '#fbbf24',
      hard: '#f87171',
    },
    verdict: {
      accepted: '#34d399',
      failed: '#f87171',
    },
    series: {
      blue: '#60a5fa',
      green: '#34d399',
      purple: '#a78bfa',
    },
  };
}
