import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';

import { createProblemDiscussion } from '@/api/discussions.api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Pagination } from '@/components/ui/Pagination';
import { DiscussionsList } from '@/features/discussions/components/DiscussionsList';
import {
  DiscussionsEmptyState,
  DiscussionsErrorState,
  DiscussionsSkeleton,
} from '@/features/discussions/components/DiscussionsStates';
import {
  MarkdownEditor,
  TagInput,
} from '@/features/discussions/components/MarkdownEditor';
import { useDiscussions } from '@/features/discussions/hooks/useDiscussions';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import type { DiscussionSort } from '@/types/discussions';
import { ApiError } from '@/types';

interface DiscussionsPanelProps {
  problemSlug: string;
}

const SORT_OPTIONS: Array<{ value: DiscussionSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_active', label: 'Most active' },
  { value: 'most_liked', label: 'Most liked' },
];

export function DiscussionsPanel({ problemSlug }: DiscussionsPanelProps) {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { error: errorToast, success } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState<DiscussionSort>('newest');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const params = useMemo(
    () => ({
      page,
      limit: 10,
      q: search || undefined,
      tag: tag || undefined,
      sort,
    }),
    [page, search, tag, sort],
  );

  const { data, isLoading, isError, error, refetch } = useDiscussions(problemSlug, params);

  const createMutation = useMutation({
    mutationFn: () =>
      createProblemDiscussion(problemSlug, {
        title: title.trim(),
        body: body.trim(),
        tags,
      }),
    onSuccess: (discussion) => {
      success('Discussion posted');
      void queryClient.invalidateQueries({ queryKey: ['discussions', problemSlug] });
      navigate(paths.discussionDetail(problemSlug, discussion.id));
    },
    onError: (err) => {
      errorToast(
        'Could not post',
        err instanceof ApiError ? err.message : 'Something went wrong.',
      );
    },
  });

  const discussions = data?.discussions ?? [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search discussions…"
          className="h-8 max-w-xs"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              setSearch(q.trim());
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8"
          onClick={() => {
            setPage(1);
            setSearch(q.trim());
          }}
        >
          Search
        </Button>
        <Input
          value={tag}
          onChange={(e) => {
            setPage(1);
            setTag(e.target.value.trim().toLowerCase());
          }}
          placeholder="Filter tag"
          className="h-8 w-32"
        />
        <select
          value={sort}
          onChange={(e) => {
            setPage(1);
            setSort(e.target.value as DiscussionSort);
          }}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="ml-auto">
          {token ? (
            <Button
              type="button"
              size="sm"
              className="h-8"
              onClick={() => setComposing((v) => !v)}
            >
              {composing ? 'Cancel' : 'New discussion'}
            </Button>
          ) : (
            <Link to={paths.login} className="text-xs text-primary hover:underline">
              Sign in to post
            </Link>
          )}
        </div>
      </div>

      {composing ? (
        <form
          className="space-y-3 rounded-lg border border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !body.trim()) {
              errorToast('Missing fields', 'Title and body are required.');
              return;
            }
            createMutation.mutate();
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Discussion title"
            className="h-9"
            disabled={createMutation.isPending}
          />
          <MarkdownEditor
            value={body}
            onChange={setBody}
            disabled={createMutation.isPending}
            label="Body"
          />
          <TagInput value={tags} onChange={setTags} disabled={createMutation.isPending} />
          <Button type="submit" size="sm" loading={createMutation.isPending}>
            Post discussion
          </Button>
        </form>
      ) : null}

      {isLoading ? <DiscussionsSkeleton /> : null}
      {isError ? (
        <DiscussionsErrorState
          message={error instanceof ApiError ? error.message : undefined}
          onRetry={() => void refetch()}
        />
      ) : null}
      {!isLoading && !isError && discussions.length === 0 ? (
        <DiscussionsEmptyState onCreate={token ? () => setComposing(true) : undefined} />
      ) : null}
      {!isLoading && !isError && discussions.length > 0 ? (
        <>
          <DiscussionsList discussions={discussions} problemSlug={problemSlug} />
          {pagination ? (
            <Pagination
              page={pagination.page}
              pageSize={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
