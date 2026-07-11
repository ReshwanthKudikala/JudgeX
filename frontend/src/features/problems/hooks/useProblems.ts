import { useCallback, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listProblems } from '@/api/problems.api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import type {
  ProblemDifficulty,
  ProblemSortField,
  ProblemSummary,
  SortDirection,
} from '@/types/problems';

export const PROBLEMS_PAGE_SIZE = 20;

export interface ProblemsQueryState {
  page: number;
  difficulty: ProblemDifficulty | 'all';
  search: string;
  sortField: ProblemSortField | null;
  sortDir: SortDirection;
}

/** Map UI sort → backend `sort` query (allow-listed columns only). */
function toBackendSort(
  field: ProblemSortField | null,
  dir: SortDirection,
): string | undefined {
  if (!field) return undefined;
  // acceptanceRate is derived — not a DB sort column. Use totalAccepted as proxy.
  const backendField =
    field === 'acceptance' ? 'totalAccepted' : field === 'title' ? 'title' : 'difficulty';
  return dir === 'desc' ? `-${backendField}` : backendField;
}

function matchesSearch(problem: ProblemSummary, search: string): boolean {
  if (!search) return true;
  return problem.title.toLowerCase().includes(search.toLowerCase());
}

/**
 * Encapsulates problems list fetching, filters, search, and sort.
 *
 * Backend supports: page, limit, sort, difficulty.
 * Backend does NOT support: `q` search, tags, solved status, global difficulty counts.
 * Title search is therefore applied client-side on the fetched page (debounced).
 * Stats Easy/Medium/Hard counts are computed from the current page only.
 */
export function useProblems() {
  const [page, setPage] = useState(1);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<ProblemSortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const debouncedSearch = useDebouncedValue(search, 300);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PROBLEMS_PAGE_SIZE,
      difficulty: difficulty === 'all' ? undefined : difficulty,
      sort: toBackendSort(sortField, sortDir),
    }),
    [page, difficulty, sortField, sortDir],
  );

  const query = useQuery({
    queryKey: ['problems', queryParams],
    queryFn: () => listProblems(queryParams),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const problems = useMemo(() => {
    const rows = query.data?.problems ?? [];
    // Client-side title filter — backend has no `q` query param yet.
    return rows.filter((p) => matchesSearch(p, debouncedSearch.trim()));
  }, [query.data?.problems, debouncedSearch]);

  const pagination = query.data?.pagination ?? {
    page,
    limit: PROBLEMS_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  };

  /**
   * Difficulty breakdown from the **current fetched page** only.
   * The list API does not return global Easy/Medium/Hard counts.
   */
  const stats = useMemo(() => {
    const source = query.data?.problems ?? [];
    return {
      total: pagination.total,
      easy: source.filter((p) => p.difficulty === 'easy').length,
      medium: source.filter((p) => p.difficulty === 'medium').length,
      hard: source.filter((p) => p.difficulty === 'hard').length,
      scope: 'page' as const,
    };
  }, [query.data?.problems, pagination.total]);

  const hasAcceptance = useMemo(
    () => (query.data?.problems ?? []).some((p) => typeof p.acceptanceRate === 'number'),
    [query.data?.problems],
  );

  const hasTags = useMemo(
    () => (query.data?.problems ?? []).some((p) => Array.isArray(p.tags) && p.tags.length > 0),
    [query.data?.problems],
  );

  const onDifficultyChange = useCallback((next: ProblemDifficulty | 'all') => {
    setDifficulty(next);
    setPage(1);
  }, []);

  const onSearchChange = useCallback((next: string) => {
    setSearch(next);
    setPage(1);
  }, []);

  const onSort = useCallback((field: ProblemSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(field === 'acceptance' ? 'desc' : 'asc');
      return field;
    });
    setPage(1);
  }, []);

  const onPageChange = useCallback((next: number) => {
    setPage(Math.max(1, next));
  }, []);

  return {
    problems,
    pagination,
    stats,
    hasAcceptance,
    hasTags,
    page,
    difficulty,
    search,
    sortField,
    sortDir,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    onDifficultyChange,
    onSearchChange,
    onSort,
    onPageChange,
  };
}
