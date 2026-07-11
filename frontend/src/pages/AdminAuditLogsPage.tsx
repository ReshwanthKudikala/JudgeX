import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
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
import { useAdminAuditLogs } from '@/features/admin/hooks/useAdmin';
import { ApiError } from '@/types';
import { formatRelativeTime } from '@/utils/relative-time';

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, error, refetch } = useAdminAuditLogs({
    page,
    limit: 20,
    q: search || undefined,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-8 max-w-sm"
          placeholder="Search actor, action, entity…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setSearch(q.trim());
            }
          }}
        />
        <Button
          size="sm"
          className="h-8"
          onClick={() => {
            setPage(1);
            setSearch(q.trim());
          }}
        >
          Search
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {isError ? (
        <p className="text-sm text-error">
          {error instanceof ApiError ? error.message : 'Failed to load logs.'}{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Retry
          </button>
        </p>
      ) : null}

      {!isLoading && !isError ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Metadata</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs.length ? (
                data.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted">
                      {formatRelativeTime(log.createdAt)}
                    </TableCell>
                    <TableCell>@{log.actorUsername}</TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs">
                      {log.entityType}
                      {log.entityId ? (
                        <span className="text-muted"> · {log.entityId.slice(0, 8)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-[11px] text-muted">
                      {JSON.stringify(log.metadata)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty>No audit logs yet.</TableEmpty>
              )}
            </TableBody>
          </Table>
          {data?.pagination ? (
            <Pagination
              page={data.pagination.page}
              pageSize={data.pagination.limit}
              total={data.pagination.total}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
