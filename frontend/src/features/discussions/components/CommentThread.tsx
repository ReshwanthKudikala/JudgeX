import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MarkdownRenderer } from '@/features/editorials';
import { MarkdownEditor } from '@/features/discussions/components/MarkdownEditor';
import type { DiscussionComment } from '@/types/discussions';
import { formatRelativeTime } from '@/utils/relative-time';
import { cn } from '@/utils/cn';

interface CommentThreadProps {
  comments: DiscussionComment[];
  depth?: number;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReport: (id: string, reason: string) => Promise<void>;
  busy?: boolean;
}

export function CommentThread({
  comments,
  depth = 0,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReport,
  busy,
}: CommentThreadProps) {
  return (
    <ul className={cn('space-y-3', depth > 0 && 'ml-4 border-l border-border pl-3')}>
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          depth={depth}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          busy={busy}
        />
      ))}
    </ul>
  );
}

function CommentItem({
  comment,
  depth,
  currentUserId,
  isAdmin,
  onReply,
  onEdit,
  onDelete,
  onReport,
  busy,
}: {
  comment: DiscussionComment;
  depth: number;
  currentUserId?: string | null;
  isAdmin?: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReport: (id: string, reason: string) => Promise<void>;
  busy?: boolean;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [replyBody, setReplyBody] = useState('');

  const canModerate =
    Boolean(currentUserId) &&
    (isAdmin || currentUserId === comment.authorId) &&
    !comment.isDeleted;

  return (
    <li className="space-y-2">
      <div className="rounded-md border border-border/60 bg-card/40 px-3 py-2">
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <span className="font-medium text-muted-foreground">
            @{comment.author?.username || 'unknown'}
          </span>
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {comment.isDeleted ? <span className="text-error">deleted</span> : null}
        </div>

        {editing ? (
          <div className="space-y-2">
            <MarkdownEditor value={draft} onChange={setDraft} rows={4} disabled={busy} />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !draft.trim()}
                onClick={async () => {
                  await onEdit(comment.id, draft.trim());
                  setEditing(false);
                }}
              >
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDraft(comment.body);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <MarkdownRenderer
            markdown={comment.body}
            className="text-sm [&_p]:my-1.5"
          />
        )}

        {!comment.isDeleted ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {currentUserId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => setReplying((v) => !v)}
              >
                Reply
              </Button>
            ) : null}
            {canModerate ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => setEditing(true)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px] text-error"
                  disabled={busy}
                  onClick={() => void onDelete(comment.id)}
                >
                  Delete
                </Button>
              </>
            ) : null}
            {currentUserId ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                disabled={busy}
                onClick={() => {
                  const reason = window.prompt('Why are you reporting this comment?');
                  if (reason && reason.trim().length >= 3) {
                    void onReport(comment.id, reason.trim());
                  }
                }}
              >
                Report
              </Button>
            ) : null}
          </div>
        ) : null}

        {replying ? (
          <div className="mt-2 space-y-2">
            <MarkdownEditor
              value={replyBody}
              onChange={setReplyBody}
              rows={3}
              disabled={busy}
              placeholder="Write a reply…"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busy || !replyBody.trim()}
                onClick={async () => {
                  await onReply(comment.id, replyBody.trim());
                  setReplyBody('');
                  setReplying(false);
                }}
              >
                Post reply
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setReplying(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {comment.replies?.length ? (
        <CommentThread
          comments={comment.replies}
          depth={depth + 1}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onReport={onReport}
          busy={busy}
        />
      ) : null}
    </li>
  );
}
