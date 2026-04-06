// ── Cursor-based pagination hook for Supabase tables ─────────────────────────
// Replaces .limit(2000) with incremental page loading via useInfiniteQuery.

import { useInfiniteQuery, type UseInfiniteQueryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 100;

interface PaginatedQueryConfig {
  queryKey: readonly unknown[];
  table: string;
  select: string;
  orderColumn?: string;
  orderAscending?: boolean;
  pageSize?: number;
  enabled?: boolean;
  filters?: (q: any) => any; // apply .eq/.or/etc to query builder
}

export function usePaginatedQuery({
  queryKey,
  table,
  select,
  orderColumn = 'criado_em',
  orderAscending = false,
  pageSize = PAGE_SIZE,
  enabled = true,
  filters,
}: PaginatedQueryConfig) {
  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }) => {
      let q = (supabase as any)
        .from(table)
        .select(select, { count: 'exact' })
        .order(orderColumn, { ascending: orderAscending })
        .range(pageParam, pageParam + pageSize - 1);

      if (filters) q = filters(q);

      const { data, error, count } = await q;
      if (error) throw error;
      return {
        data: data || [],
        nextOffset: (data?.length || 0) < pageSize ? undefined : pageParam + pageSize,
        totalCount: count ?? 0,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
    enabled,
    staleTime: 60_000,
    gcTime: 15 * 60 * 1000,
  });
}

/** Flatten all pages into a single array */
export function flattenPages<T>(data: { pages: Array<{ data: T[] }> } | undefined): T[] {
  if (!data) return [];
  return data.pages.flatMap(p => p.data);
}
