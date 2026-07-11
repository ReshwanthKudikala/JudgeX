interface LeaderboardEmptyStateProps {
  timeframeLabel?: string;
}

export function LeaderboardEmptyState({
  timeframeLabel = 'this period',
}: LeaderboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-white">No rankings yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        No judged submissions for {timeframeLabel}. Solve a problem to appear on
        the board.
      </p>
    </div>
  );
}
