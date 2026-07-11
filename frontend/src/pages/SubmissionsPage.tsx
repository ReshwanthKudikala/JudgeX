import { SubmissionsHistoryPanel } from '@/features/submissions/components/SubmissionsHistoryPanel';

export function SubmissionsPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-white">Submissions</h1>
        <p className="mt-1 text-sm text-muted">
          Your judging history — newest first. Open a row for source and metrics.
        </p>
      </div>

      <SubmissionsHistoryPanel />
    </div>
  );
}
