import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Skeleton } from '@/components/common/Skeleton';
import {
  useAdminFailedJobs,
  useAdminQueue,
  useAdminQueueActions,
} from '@/features/admin/hooks/useAdmin';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/types';

export function AdminQueuePage() {
  const { success, error: errorToast } = useToast();
  const queue = useAdminQueue();
  const failed = useAdminFailedJobs();
  const actions = useAdminQueueActions();

  if (queue.isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  if (queue.isError || !queue.data) {
    return (
      <p className="text-sm text-error">
        {queue.error instanceof ApiError
          ? queue.error.message
          : 'Failed to load queue.'}{' '}
        <button type="button" className="underline" onClick={() => void queue.refetch()}>
          Retry
        </button>
      </p>
    );
  }

  const counts = queue.data.counts;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(['waiting', 'active', 'completed', 'failed', 'delayed'] as const).map((key) => (
          <Card key={key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm capitalize text-muted">{key}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{counts[key] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={actions.retryFailed.isPending}
          onClick={async () => {
            try {
              const result = await actions.retryFailed.mutateAsync();
              success(`Retried ${result.retried} jobs`);
              void failed.refetch();
            } catch (err) {
              errorToast(
                'Retry failed',
                err instanceof ApiError ? err.message : 'Try again',
              );
            }
          }}
        >
          Retry failed jobs
        </Button>
        <Button
          size="sm"
          variant="secondary"
          loading={actions.clearCompleted.isPending}
          onClick={async () => {
            try {
              await actions.clearCompleted.mutateAsync();
              success('Completed jobs cleared');
            } catch (err) {
              errorToast(
                'Clear failed',
                err instanceof ApiError ? err.message : 'Try again',
              );
            }
          }}
        >
          Clear completed
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Failed jobs (read-only detail)</CardTitle>
        </CardHeader>
        <CardContent>
          {failed.isLoading ? <Skeleton className="h-40 w-full" /> : null}
          {!failed.isLoading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Submission</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.data?.jobs.length ? (
                  failed.data.jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-xs">{job.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {job.data.submissionId || '—'}
                      </TableCell>
                      <TableCell>{job.attemptsMade}</TableCell>
                      <TableCell className="max-w-md truncate text-xs text-muted">
                        {job.failedReason || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableEmpty>No failed jobs.</TableEmpty>
                )}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
