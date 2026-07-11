import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { paths } from '@/routes/paths';
import type { DiscussionSummary } from '@/types/discussions';
import { formatRelativeTime } from '@/utils/relative-time';

interface DiscussionsListProps {
  discussions: DiscussionSummary[];
  problemSlug: string;
}

export function DiscussionsList({ discussions, problemSlug }: DiscussionsListProps) {
  return (
    <ul className="space-y-2">
      {discussions.map((item) => (
        <li key={item.id}>
          <Link
            to={paths.discussionDetail(problemSlug, item.id)}
            className="block rounded-lg border border-border px-3 py-3 transition-colors hover:border-primary/40 hover:bg-white/[0.02]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
              <span className="text-[11px] text-muted">
                {formatRelativeTime(item.createdAt)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {item.bodyPreview}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
              <span>@{item.author?.username || 'unknown'}</span>
              <span>· {item.commentCount} comments</span>
              <span>· {item.likeCount} likes</span>
              {item.tags.map((tag) => (
                <Badge key={tag} className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
