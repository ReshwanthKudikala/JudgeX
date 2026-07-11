import { useToastStore } from '@/store';

/** Convenience wrapper around the global toast store. */
export function useToast() {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);

  return {
    toast: push,
    dismiss,
    success: (title: string, description?: string) =>
      push({ title, description, variant: 'success' }),
    error: (title: string, description?: string) =>
      push({ title, description, variant: 'error' }),
  };
}
