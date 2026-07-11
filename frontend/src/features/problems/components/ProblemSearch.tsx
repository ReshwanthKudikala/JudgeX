import { Search } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/utils/cn';

interface ProblemSearchProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ProblemSearch({ value, onChange, className }: ProblemSearchProps) {
  return (
    <div className={cn('relative w-full max-w-xs', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search titles…"
        className="pl-9"
        aria-label="Search problems by title"
        autoComplete="off"
      />
    </div>
  );
}
