/**
 * Optional empty state — unused while Monaco loads via Suspense fallback.
 * Kept for sprint deliverable completeness / future offline messaging.
 */
export function EditorEmptyState({ message = 'Editor unavailable' }: { message?: string }) {
  return (
    <div
      className="flex min-h-[240px] flex-1 flex-col items-center justify-center gap-2 bg-[#0c0e12] px-4 text-center"
      role="status"
    >
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  );
}
