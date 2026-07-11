import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { listSubmissions } from '@/api/submissions.api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type {
  SubmissionLanguage,
  SubmissionListParams,
  SubmissionVerdict,
} from '@/types/submissions';

export const SUBMISSIONS_PAGE_SIZE = 20;

export const submissionsQueryKey = (params: SubmissionListParams) =>
  ['submissions', params] as const;

export interface UseSubmissionsOptions {
  /** Lock the list to a single problem (problem page tab). */
  problemId?: string;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Paginated submission history for the authenticated user.
 * Stable query keys + keepPreviousData for smooth pagination.
 */
export function useSubmissions(options: UseSubmissionsOptions = {}) {
  const { problemId, pageSize = SUBMISSIONS_PAGE_SIZE, enabled = true } = options;

  const [page, setPage] = useState(1);
  const [verdict, setVerdict] = useState<SubmissionVerdict | 'all'>('all');
  const [language, setLanguage] = useState<SubmissionLanguage | 'all'>('all');
  const [search, setSearch] = useState('');

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = useMemo((): SubmissionListParams => {
    const params: SubmissionListParams = {
      page,
      limit: pageSize,
      sort: '-submittedAt',
    };
    if (problemId) params.problemId = problemId;
    if (verdict !== 'all') params.verdict = verdict;
    if (language !== 'all') params.language = language;
    if (debouncedSearch.trim() && !problemId) {
      params.q = debouncedSearch.trim();
    }
    return params;
  }, [page, pageSize, problemId, verdict, language, debouncedSearch]);

  const query = useQuery({
    queryKey: submissionsQueryKey(queryParams),
    queryFn: () => listSubmissions(queryParams),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const onVerdictChange = useCallback((next: SubmissionVerdict | 'all') => {
    setVerdict(next);
    setPage(1);
  }, []);

  const onLanguageChange = useCallback((next: SubmissionLanguage | 'all') => {
    setLanguage(next);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const onPageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  return {
    submissions: query.data?.submissions ?? [],
    pagination: query.data?.pagination ?? {
      page,
      limit: pageSize,
      total: 0,
      totalPages: 0,
    },
    page,
    verdict,
    language,
    search,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    onVerdictChange,
    onLanguageChange,
    onSearchChange,
    onPageChange,
    isFiltered:
      verdict !== 'all' ||
      language !== 'all' ||
      Boolean(debouncedSearch.trim()),
  };
}
