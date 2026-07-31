import { useCallback, useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Input } from '@/components/ui/Input';
import { paths } from '@/routes/paths';
import { cn } from '@/utils/cn';

function modKeyLabel() {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';
}

/**
 * Global header search (GitHub / VS Code style).
 * On /problems, syncs with `?q=`. Elsewhere, Enter navigates to Problems with the query.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const onProblems = location.pathname === paths.problems;
  const urlQ = onProblems ? searchParams.get('q') ?? '' : '';
  const [value, setValue] = useState(urlQ);
  const mod = modKeyLabel();

  useEffect(() => {
    if (onProblems) setValue(urlQ);
  }, [onProblems, urlQ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const pressed = event.ctrlKey || event.metaKey;
      if (!pressed || (event.key !== 'k' && event.key !== 'K')) return;
      event.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (location.hash === '#search') {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [location.hash]);

  const commit = useCallback(
    (raw: string) => {
      const q = raw.trim();
      if (onProblems) {
        const next = new URLSearchParams(searchParams);
        if (q) next.set('q', q);
        else next.delete('q');
        setSearchParams(next, { replace: true });
        return;
      }
      const target = q
        ? `${paths.problems}?q=${encodeURIComponent(q)}`
        : paths.problems;
      navigate(target);
    },
    [navigate, onProblems, searchParams, setSearchParams],
  );

  return (
    <div className={cn('relative w-full max-w-md', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        ref={inputRef}
        id="global-problem-search"
        type="search"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (onProblems) {
            const params = new URLSearchParams(searchParams);
            if (next.trim()) params.set('q', next.trim());
            else params.delete('q');
            setSearchParams(params, { replace: true });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit(value);
          }
        }}
        placeholder="Search problems…"
        className="h-9 border-border/80 bg-surface pl-9 pr-14 text-sm"
        aria-label={`Search problems (${mod}+K)`}
        title={`Search problems (${mod}+K)`}
        autoComplete="off"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted sm:inline">
        {mod}+K
      </kbd>
    </div>
  );
}

/** Focus header search, or navigate to Problems#search when header input is missing. */
export function GlobalProblemSearchShortcut() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod || (event.key !== 'k' && event.key !== 'K')) return;

      const el = document.getElementById(
        'global-problem-search',
      ) as HTMLInputElement | null;
      if (el) {
        event.preventDefault();
        el.focus();
        el.select();
        return;
      }

      event.preventDefault();
      navigate(`${paths.problems}#search`);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return null;
}
