import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { Spinner } from '@/components/common/Spinner';
import { cn } from '@/utils/cn';

const variants = {
  primary:
    'bg-primary text-[#1a1a1a] hover:bg-primary-hover focus-visible:ring-primary',
  secondary:
    'bg-transparent border border-border text-muted-foreground hover:bg-white/5 hover:text-white focus-visible:ring-border',
  ghost:
    'bg-transparent text-muted-foreground hover:bg-white/5 hover:text-white focus-visible:ring-border',
  danger:
    'bg-error/15 text-error border border-error/30 hover:bg-error/25 focus-visible:ring-error',
} as const;

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current [&_div]:border-current [&_div]:border-t-transparent" /> : null}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
