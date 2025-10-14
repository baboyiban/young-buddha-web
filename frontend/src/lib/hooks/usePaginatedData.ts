import { useMemo, useCallback } from "react";
import useSWRInfinite from "swr/infinite";

interface PaginatedDataParams<T, F> {
  queryKey: (string | F)[];
  queryFn: (
    params: F & { page: number; pageSize: number },
  ) => Promise<{ data: T[]; totalCount: number }>;
  filters: F;
  options?: {
    enabled?: boolean;
  };
}

export function usePaginatedData<T extends { id: unknown }, F>({
  queryKey,
  queryFn,
  filters,
  options = {},
}: PaginatedDataParams<T, F>) {
  const pageSize = 10;
  const filtersJson = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filtersJson]);

  const getKey = (pageIndex: number, previousPageData: any) => {
    // 마지막 페이지에 도달했으면 중지
    if (previousPageData && !previousPageData.data.length) return null;

    // 필터가 변경되면 첫 페이지부터 다시 시작
    if (pageIndex === 0) {
      return [...queryKey, { ...stableFilters, page: 1 }];
    }

    return [...queryKey, { ...stableFilters, page: pageIndex + 1 }];
  };

  const { data, error, size, setSize, mutate, isLoading } = useSWRInfinite(
    getKey,
    (key: any[]) => {
      const lastKey = key[key.length - 1] as { page?: number };
      const page = lastKey?.page || 1;
      return queryFn({ page, pageSize, ...stableFilters });
    },
    {
      revalidateFirstPage: false,
      revalidateOnFocus: true,
      revalidateOnMount: true,
      parallel: true,
    },
  );

  const allData = useMemo(
    () => (data ? data.flatMap((page) => page.data) : []),
    [data],
  );

  const totalCount = data?.[0]?.totalCount ?? 0;
  const hasMore = allData.length < totalCount;

  const loadMore = useCallback(() => {
    if (hasMore) setSize(size + 1);
  }, [hasMore, size, setSize]);

  const loadPayments = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    requests: allData,
    totalCount,
    loading: isLoading,
    error: error ? error.message : null,
    hasMore,
    loadPayments,
    loadMore,
  };
}
