import { cn } from '@/utils/cn';

const sizeMap = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-10 w-10 border-[3px]',
} as const;

interface SpinnerProps {
  size?: keyof typeof sizeMap;
  className?: string;
  label?: string;
}

export function Spinner({ size = 'md', className, label }: SpinnerProps) {
  return (
    <div className={cn('inline-flex flex-col items-center gap-2', className)} role="status">
      <div
        className={cn(
          'animate-spin rounded-full border-primary border-t-transparent',
          sizeMap[size],
        )}
      />
      {label ? <span className="text-sm text-muted">{label}</span> : null}
      <span className="sr-only">Loading</span>
    </div>
  );
}
