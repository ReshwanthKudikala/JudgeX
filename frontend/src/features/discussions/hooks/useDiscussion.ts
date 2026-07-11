import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createComment,
  deleteComment,
  deleteDiscussion,
  getDiscussion,
  reportComment,
  reportDiscussion,
  updateComment,
  updateDiscussion,
} from '@/api/discussions.api';
import type { CreateCommentInput, UpdateDiscussionInput } from '@/types/discussions';

export function useDiscussion(id: string | undefined) {
  return useQuery({
    queryKey: ['discussion', id],
    queryFn: () => getDiscussion(id as string),
    enabled: Boolean(id),
    staleTime: 15_000,
  });
}

export function useDiscussionMutations(discussionId: string | undefined, problemSlug?: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (discussionId) {
      void queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
    }
    if (problemSlug) {
      void queryClient.invalidateQueries({ queryKey: ['discussions', problemSlug] });
    }
  };

  const update = useMutation({
    mutationFn: (input: UpdateDiscussionInput) =>
      updateDiscussion(discussionId as string, input),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => deleteDiscussion(discussionId as string),
    onSuccess: invalidate,
  });

  const addComment = useMutation({
    mutationFn: (input: CreateCommentInput) =>
      createComment(discussionId as string, input),
    onSuccess: invalidate,
  });

  const editComment = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) => updateComment(id, body),
    onSuccess: invalidate,
  });

  const removeComment = useMutation({
    mutationFn: (id: string) => deleteComment(id),
    onSuccess: invalidate,
  });

  const reportThread = useMutation({
    mutationFn: (reason: string) => reportDiscussion(discussionId as string, reason),
  });

  const reportReply = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      reportComment(id, reason),
  });

  return {
    update,
    remove,
    addComment,
    editComment,
    removeComment,
    reportThread,
    reportReply,
  };
}
