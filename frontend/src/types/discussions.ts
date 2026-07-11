import type { PaginationMeta } from '@/types/problems';

export type DiscussionSort = 'newest' | 'most_active' | 'most_liked';

export interface DiscussionAuthor {
  id: string;
  username: string | null;
}

export interface DiscussionSummary {
  id: string;
  problemId: string;
  problemSlug?: string;
  authorId: string;
  author: DiscussionAuthor | null;
  title: string;
  bodyPreview: string;
  tags: string[];
  likeCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionComment {
  id: string;
  discussionId: string;
  authorId: string;
  author: DiscussionAuthor | null;
  body: string;
  parentCommentId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  replies: DiscussionComment[];
}

export interface DiscussionDetail extends Omit<DiscussionSummary, 'bodyPreview'> {
  body: string;
  comments: DiscussionComment[];
}

export interface DiscussionListParams {
  page?: number;
  limit?: number;
  q?: string;
  tag?: string;
  sort?: DiscussionSort;
}

export interface DiscussionListResult {
  discussions: DiscussionSummary[];
  pagination: PaginationMeta;
}

export interface CreateDiscussionInput {
  title: string;
  body: string;
  tags?: string[];
}

export interface UpdateDiscussionInput {
  title?: string;
  body?: string;
  tags?: string[];
}

export interface CreateCommentInput {
  body: string;
  parentCommentId?: string | null;
}

export interface DiscussionReport {
  id: string;
  targetType: 'discussion' | 'comment';
  targetId: string;
  status: string;
  createdAt: string;
}
