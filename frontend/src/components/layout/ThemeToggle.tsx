import { useEffect } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import {
  useThemeStore,
  type ThemePreference,
} from '@/store/theme.store';
import { cn } from '@/utils/cn';

const LABELS: Record<ThemePreference, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme',
};

const ICONS = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

interface ThemeToggleProps {
  className?: string;
  /** Compact icon-only control for the navbar. */
  compact?: boolean;
}

export function ThemeToggle({ className, compact = true }: ThemeToggleProps) {
  const preference = useThemeStore((s) => s.preference);
  const cyclePreference = useThemeStore((s) => s.cyclePreference);
  const Icon = ICONS[preference];

  useEffect(() => {
    // Ensure store is hydrated against DOM on mount (FOUC script may have set class).
    const { preference: pref, setPreference } = useThemeStore.getState();
    setPreference(pref);
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => cyclePreference()}
      className={cn(compact && 'px-2', className)}
      aria-label={`${LABELS[preference]}. Click to change.`}
      title={`${LABELS[preference]} (click to cycle)`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {!compact ? <span>{LABELS[preference]}</span> : null}
    </Button>
  );
}
