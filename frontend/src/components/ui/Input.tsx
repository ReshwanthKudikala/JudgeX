import { forwardRef, type InputHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border bg-background px-3 text-sm text-white',
        'placeholder:text-muted/80',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:border-primary/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error ? 'border-error' : 'border-border',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
