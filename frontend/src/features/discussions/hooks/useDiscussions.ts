import { useQuery } from '@tanstack/react-query';

import { listProblemDiscussions } from '@/api/discussions.api';
import type { DiscussionListParams } from '@/types/discussions';

export function useDiscussions(
  slug: string | undefined,
  params: DiscussionListParams = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ['discussions', slug, params],
    queryFn: () => listProblemDiscussions(slug as string, params),
    enabled: Boolean(slug) && enabled,
    staleTime: 30_000,
  });
}
