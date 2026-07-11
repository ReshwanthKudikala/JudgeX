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
  useAdminUserActions,
  useAdminUsers,
} from '@/features/admin/hooks/useAdmin';
import { useToast } from '@/hooks/useToast';
import { ApiError } from '@/types';
import { formatRelativeTime } from '@/utils/relative-time';

export function AdminUsersPage() {
  const { success, error: errorToast } = useToast();
  const [page, setPage] = useState(1);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'user' | 'admin' | ''>('');
  const [status, setStatus] = useState<'active' | 'suspended' | ''>('');
  const [applied, setApplied] = useState({
    username: '',
    email: '',
    role: '' as '' | 'user' | 'admin',
    status: '' as '' | 'active' | 'suspended',
  });

  const params = {
    page,
    limit: 20,
    username: applied.username || undefined,
    email: applied.email || undefined,
    role: applied.role || undefined,
    status: applied.status || undefined,
  };

  const { data, isLoading, isError, error, refetch } = useAdminUsers(params);
  const actions = useAdminUserActions();

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      success(label);
    } catch (err) {
      errorToast(label, err instanceof ApiError ? err.message : 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-8 w-40"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          className="h-8 w-48"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button
          size="sm"
          className="h-8"
          onClick={() => {
            setPage(1);
            setApplied({ username, email, role, status });
          }}
        >
          Search
        </Button>
      </div>

      {isLoading ? <Skeleton className="h-64 w-full rounded-lg" /> : null}
      {isError ? (
        <p className="text-sm text-error">
          {error instanceof ApiError ? error.message : 'Failed to load users.'}{' '}
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
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.users.length ? (
                data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.username}</TableCell>
                    <TableCell className="text-xs text-muted">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'primary' : 'default'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isSuspended ? 'error' : 'success'}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {formatRelativeTime(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt) : '—'}
                    </TableCell>
                    <TableCell>{user.submissionCount ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {user.isSuspended ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              void run('User unsuspended', () =>
                                actions.unsuspend.mutateAsync(user.id),
                              )
                            }
                          >
                            Unsuspend
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              void run('User suspended', () =>
                                actions.suspend.mutateAsync(user.id),
                              )
                            }
                          >
                            Suspend
                          </Button>
                        )}
                        {user.role === 'admin' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              void run('Admin demoted', () =>
                                actions.demote.mutateAsync(user.id),
                              )
                            }
                          >
                            Demote
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-[11px]"
                            onClick={() =>
                              void run('User promoted', () =>
                                actions.promote.mutateAsync(user.id),
                              )
                            }
                          >
                            Promote
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableEmpty>No users found.</TableEmpty>
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
