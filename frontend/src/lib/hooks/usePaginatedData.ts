import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

interface PaginatedDataParams<T, F> {
  queryKey: (string | F)[];
  queryFn: (params: F & { page: number; pageSize: number }) => Promise<{ data: T[]; totalCount: number }>;
  filters: F;
  options?: {
    enabled?: boolean;
  };
}

export function usePaginatedData<T extends { id: unknown }, F>({ 
  queryKey, 
  queryFn, 
  filters, 
  options = {} 
}: PaginatedDataParams<T, F>) {
  const [allData, setAllData] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const stableFilters = useMemo(() => filters, [JSON.stringify(filters)]);

  const { data, isLoading, error, refetch, isPlaceholderData } = useQuery({
    queryKey: [...queryKey, { ...stableFilters, page }],
    queryFn: () => queryFn({ page, pageSize, ...stableFilters }),
    placeholderData: (previousData) => previousData,
    retry: 1,
    enabled: options.enabled,
  });

  useEffect(() => {
    if (data?.data && !isPlaceholderData) {
      setAllData((prev) => {
        const newItems = data.data;
        const allItems = page === 1 ? newItems : [...prev, ...newItems];
        const uniqueItems = Array.from(
          new Map(allItems.map((item) => [item.id, item])).values()
        );
        return uniqueItems;
      });
    }
  }, [data, page, isPlaceholderData]);

  useEffect(() => {
    setPage(1);
    setAllData([]);
  }, [stableFilters]);

  const totalCount = data?.totalCount ?? 0;
  const hasMore = allData.length < totalCount;

  const loadMore = useCallback(() => {
    if (hasMore) {
      setPage((p) => p + 1);
    }
  }, [hasMore]);

  return {
    requests: allData,
    totalCount,
    loading: isLoading,
    error: error ? (error as Error).message : null,
    hasMore,
    loadPayments: refetch,
    loadMore,
  };
}
