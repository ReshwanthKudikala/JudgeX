import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CommentThread } from '@/features/discussions/components/CommentThread';
import {
  DiscussionsErrorState,
  DiscussionsSkeleton,
} from '@/features/discussions/components/DiscussionsStates';
import { MarkdownEditor } from '@/features/discussions/components/MarkdownEditor';
import {
  useDiscussion,
  useDiscussionMutations,
} from '@/features/discussions/hooks/useDiscussion';
import { MarkdownRenderer } from '@/features/editorials';
import { useToast } from '@/hooks/useToast';
import { paths } from '@/routes/paths';
import { useAuthStore } from '@/store';
import { ApiError } from '@/types';
import { formatRelativeTime } from '@/utils/relative-time';

export function DiscussionDetailPage() {
  const { slug, discussionId } = useParams<{
    slug: string;
    discussionId: string;
  }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const { success, error: errorToast } = useToast();

  const { data, isLoading, isError, error, refetch } = useDiscussion(discussionId);
  const mutations = useDiscussionMutations(discussionId, slug);

  const [commentBody, setCommentBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  if (!discussionId) {
    return <DiscussionsErrorState message="Discussion not found." />;
  }

  if (isLoading) return <DiscussionsSkeleton />;

  if (isError || !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <DiscussionsErrorState
        message={
          notFound
            ? 'Discussion not found.'
            : error instanceof ApiError
              ? error.message
              : 'Could not load discussion.'
        }
        onRetry={notFound ? undefined : () => void refetch()}
      />
    );
  }

  const canModerate =
    Boolean(user) && (user?.role === 'admin' || user?.id === data.authorId);
  const busy =
    mutations.addComment.isPending ||
    mutations.editComment.isPending ||
    mutations.removeComment.isPending ||
    mutations.update.isPending ||
    mutations.remove.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div className="space-y-1">
        <Link
          to={slug ? paths.problemDetail(slug) : paths.problems}
          className="text-xs text-muted hover:text-foreground"
        >
          ← Back to problem
        </Link>
        {editing ? (
          <div className="space-y-3 rounded-lg border border-border p-3">
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
            <MarkdownEditor value={editBody} onChange={setEditBody} rows={8} />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                loading={mutations.update.isPending}
                onClick={async () => {
                  try {
                    await mutations.update.mutateAsync({
                      title: editTitle.trim(),
                      body: editBody.trim(),
                    });
                    setEditing(false);
                    success('Discussion updated');
                  } catch (err) {
                    errorToast(
                      'Update failed',
                      err instanceof ApiError ? err.message : 'Try again.',
                    );
                  }
                }}
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold text-foreground">{data.title}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>@{data.author?.username || 'unknown'}</span>
              <span>· {formatRelativeTime(data.createdAt)}</span>
              <span>· {data.commentCount} comments</span>
              {data.tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          </>
        )}
      </div>

      {!editing ? (
        <article className="rounded-lg border border-border bg-card p-4">
          <MarkdownRenderer markdown={data.body} />
        </article>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canModerate && !editing ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditTitle(data.title);
                setEditBody(data.body);
                setEditing(true);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Delete this discussion?')) return;
                try {
                  await mutations.remove.mutateAsync();
                  success('Discussion deleted');
                  navigate(slug ? paths.problemDetail(slug) : paths.problems);
                } catch (err) {
                  errorToast(
                    'Delete failed',
                    err instanceof ApiError ? err.message : 'Try again.',
                  );
                }
              }}
            >
              Delete
            </Button>
          </>
        ) : null}
        {token ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={async () => {
              const reason = window.prompt('Why are you reporting this discussion?');
              if (!reason || reason.trim().length < 3) return;
              try {
                await mutations.reportThread.mutateAsync(reason.trim());
                success('Report submitted');
              } catch (err) {
                errorToast(
                  'Report failed',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              }
            }}
          >
            Report
          </Button>
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Comments</h2>
        {data.comments.length === 0 ? (
          <p className="text-sm text-muted">No comments yet.</p>
        ) : (
          <CommentThread
            comments={data.comments}
            currentUserId={user?.id}
            isAdmin={user?.role === 'admin'}
            busy={busy}
            onReply={async (parentId, body) => {
              try {
                await mutations.addComment.mutateAsync({
                  body,
                  parentCommentId: parentId,
                });
              } catch (err) {
                errorToast(
                  'Reply failed',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              }
            }}
            onEdit={async (id, body) => {
              try {
                await mutations.editComment.mutateAsync({ id, body });
                success('Comment updated');
              } catch (err) {
                errorToast(
                  'Edit failed',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              }
            }}
            onDelete={async (id) => {
              if (!window.confirm('Delete this comment?')) return;
              try {
                await mutations.removeComment.mutateAsync(id);
                success('Comment deleted');
              } catch (err) {
                errorToast(
                  'Delete failed',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              }
            }}
            onReport={async (id, reason) => {
              try {
                await mutations.reportReply.mutateAsync({ id, reason });
                success('Report submitted');
              } catch (err) {
                errorToast(
                  'Report failed',
                  err instanceof ApiError ? err.message : 'Try again.',
                );
              }
            }}
          />
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-border p-3">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
          Add a comment
        </h3>
        {token ? (
          <>
            <MarkdownEditor
              value={commentBody}
              onChange={setCommentBody}
              rows={5}
              disabled={mutations.addComment.isPending}
            />
            <Button
              type="button"
              size="sm"
              loading={mutations.addComment.isPending}
              disabled={!commentBody.trim()}
              onClick={async () => {
                try {
                  await mutations.addComment.mutateAsync({ body: commentBody.trim() });
                  setCommentBody('');
                  success('Comment posted');
                } catch (err) {
                  errorToast(
                    'Comment failed',
                    err instanceof ApiError ? err.message : 'Try again.',
                  );
                }
              }}
            >
              Post comment
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted">
            <Link to={paths.login} className="text-primary hover:underline">
              Sign in
            </Link>{' '}
            to join the discussion.
          </p>
        )}
      </section>
    </div>
  );
}
