export function ContestsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-white">No contests yet</h2>
      <p className="mt-2 max-w-md text-sm text-muted">
        Contests will appear here when published by an admin.
      </p>
    </div>
  );
}
