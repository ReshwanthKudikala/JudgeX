import { X } from 'lucide-react';

import { useToastStore } from '@/store';
import { cn } from '@/utils/cn';

const variantStyles = {
  default: 'border-border',
  success: 'border-success/40',
  error: 'border-error/40',
} as const;

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto animate-slide-up rounded-lg border bg-card px-4 py-3 shadow-card',
            variantStyles[toast.variant],
          )}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">{toast.title}</p>
              {toast.description ? (
                <p className="mt-0.5 text-xs text-muted">{toast.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded p-0.5 text-muted transition-colors hover:text-white"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
