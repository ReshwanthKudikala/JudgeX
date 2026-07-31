import { useEffect, useRef } from 'react';
import { Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

import { Input } from '@/components/ui/Input';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

interface ProblemSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

function modKeyLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
}

export function ProblemSearch({ value, onChange, className }: ProblemSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mod = modKeyLabel();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modPressed = event.ctrlKey || event.metaKey;
      if (!modPressed) return;
      if (event.key !== 'k' && event.key !== 'K') return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        target?.isContentEditable
      ) {
        // Allow Cmd+K even from inputs to jump to problem search.
      }

      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#search') {
      inputRef.current?.focus();
    }
  }, []);

  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        ref={inputRef}
        id="problem-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search titles…"
        className="pl-9 pr-14"
        aria-label={`Search problems by title (${mod}+K)`}
        title={`Search problems (${mod}+K)`}
        autoComplete="off"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
        {mod}+K
      </kbd>
    </div>
  );
}

/** Global Cmd/Ctrl+K → navigate to Problems and focus search. */
export function GlobalProblemSearchShortcut() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || (event.key !== 'k' && event.key !== 'K')) return;

      // Problems page handles focus locally.
      if (location.pathname === paths.problems) return;

      event.preventDefault();
      navigate(`${paths.problems}#search`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, location.pathname]);

  return null;
}
