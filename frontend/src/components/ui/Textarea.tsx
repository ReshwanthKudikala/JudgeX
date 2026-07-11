import { forwardRef, type TextareaHTMLAttributes } from 'react';

import { cn } from '@/utils/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[96px] w-full rounded-md border bg-background px-3 py-2 text-sm text-white',
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

Textarea.displayName = 'Textarea';
