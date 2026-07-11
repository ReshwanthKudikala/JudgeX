import { useState } from 'react';

import { Badge } from '@/components/ui/Badge';
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
import {
  useAdminBulkModeration,
  useAdminModeration,
} from '@/features/admin/hooks/useAdmin';
import { useToast } from '@/hooks/useToast';
import type { ModerationAction, ModerationEntityType } from '@/types/admin';
import { ApiError } from '@/types';
import { formatRelativeTime } from '@/utils/relative-time';

const ENTITY_TYPES: ModerationEntityType[] = [
  'problems',
  'editorials',
  'discussions',
  'comments',
];

export function AdminModerationPage() {
  const { success, error: errorToast } = useToast();
  const [entityType, setEntityType] = useState<ModerationEntityType>('problems');
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading, isError, error, refetch } = useAdminModeration({
    entityType,
    page,
    limit: 20,
    q: search || undefined,
    status: status || undefined,
  });
  const bulk = useAdminBulkModeration();

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const runBulk = async (action: ModerationAction) => {
    if (!selected.length) {
      errorToast('Select items', 'Choose at least one row.');
      return;
    }
    try {
      const result = await bulk.mutateAsync({ entityType, action, ids: selected });
      success(`${action}: ${result.affected} updated`);
      setSelected([]);
    } catch (err) {
      errorToast('Bulk failed', err instanceof ApiError ? err.message : 'Try again');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value as ModerationEntityType);
            setPage(1);
            setSelected([]);
          }}
        >
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          className="h-8 w-48"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Default</option>
          <option value="published">Published</option>
          <option value="unpublished">Unpublished</option>
          <option value="deleted">Deleted</option>
        </select>
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

      <div className="flex flex-wrap gap-2">
        {(['publish', 'unpublish', 'delete', 'restore'] as ModerationAction[]).map(
          (action) => (
            <Button
              key={action}
              size="sm"
              variant="secondary"
              className="h-8"
              disabled={bulk.isPending || selected.length === 0}
              onClick={() => void runBulk(action)}
            >
              {action}
            </Button>
          ),
        )}
      </div>

      {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {isError ? (
        <p className="text-sm text-error">
          {error instanceof ApiError ? error.message : 'Failed to load.'}{' '}
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
                <TableHead className="w-10" />
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.length ? (
                data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{item.title || item.slug || item.id}</div>
                      {item.slug ? (
                        <div className="text-[11px] text-muted">{item.slug}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {item.isDeleted ? (
                        <Badge variant="error">deleted</Badge>
                      ) : item.published === true ? (
                        <Badge variant="success">published</Badge>
                      ) : item.published === false ? (
                        <Badge>unpublished</Badge>
                      ) : (
                        <Badge>active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {item.authorUsername ? `@${item.authorUsername}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {formatRelativeTime(item.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty>No items.</TableEmpty>
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
