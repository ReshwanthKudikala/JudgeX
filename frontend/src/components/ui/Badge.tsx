import type { HTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

const variants = {
  default: 'bg-white/5 text-muted-foreground border-border',
  primary: 'bg-primary-muted text-primary border-primary/30',
  success: 'bg-success/15 text-success border-success/30',
  error: 'bg-error/15 text-error border-error/30',
  easy: 'bg-success/15 text-success border-success/30',
  medium: 'bg-primary-muted text-primary border-primary/30',
  hard: 'bg-error/15 text-error border-error/30',
} as const;

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
