export function DiscussionsSkeleton() {
  return (
    <div className="animate-pulse space-y-3 py-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border border-border p-3">
          <div className="h-4 w-2/3 rounded bg-muted/30" />
          <div className="h-3 w-full rounded bg-muted/20" />
          <div className="h-3 w-1/2 rounded bg-muted/20" />
        </div>
      ))}
    </div>
  );
}

export function DiscussionsEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
      <p className="text-sm text-muted">No discussions yet. Be the first to ask a question.</p>
      {onCreate ? (
        <button
          type="button"
          onClick={onCreate}
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          Start a discussion
        </button>
      ) : null}
    </div>
  );
}

export function DiscussionsErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-8 text-center">
      <p className="text-sm text-error">{message || 'Could not load discussions.'}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
