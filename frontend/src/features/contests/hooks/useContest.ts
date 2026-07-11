import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getContest,
  getContestProblems,
  joinContest,
} from '@/api/contests.api';

export const contestDetailQueryKey = (id: string) => ['contest', id] as const;
export const contestProblemsQueryKey = (id: string) =>
  ['contest', id, 'problems'] as const;

export function useContest(id: string | undefined) {
  return useQuery({
    queryKey: contestDetailQueryKey(id ?? ''),
    queryFn: () => getContest(id!),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useContestProblems(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: contestProblemsQueryKey(id ?? ''),
    queryFn: () => getContestProblems(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 10_000,
    retry: false,
  });
}

export function useJoinContest(contestId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => joinContest(contestId!),
    onSuccess: () => {
      if (!contestId) return;
      void queryClient.invalidateQueries({ queryKey: contestDetailQueryKey(contestId) });
      void queryClient.invalidateQueries({ queryKey: contestProblemsQueryKey(contestId) });
      void queryClient.invalidateQueries({ queryKey: ['contests'] });
    },
  });
}
