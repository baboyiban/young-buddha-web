import { useCallback, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { PaymentRequest } from "@/lib/types/payment";
import { fetchPaymentsPage } from "@/lib/api/payment";
import { toYMD } from "@/lib/utils/dateUtils";

export interface InfinitePaymentsOptions {
  email: string | undefined;
  statusFilter?: string; // default: "전체"
  typeFilter?: string; // default: "전체"
  pageSize?: number; // default: 10
}

export function useInfinitePayments({
  email,
  statusFilter = "전체",
  typeFilter = "전체",
  pageSize = 10,
}: InfinitePaymentsOptions) {
  const getKey = useCallback(
    (pageIndex: number, previousPageData: PaymentRequest[] | null) => {
      if (!email) return null;
      // If previous page was an empty array, we've reached the end
      if (previousPageData && previousPageData.length === 0) return null;
      return [
        "payments",
        email,
        statusFilter,
        typeFilter,
        pageIndex + 1, // 1-based page for API
        pageSize,
      ] as const;
    },
    [email, statusFilter, typeFilter, pageSize]
  );

  const fetcher = useCallback(async ([, em, status, type, page, limit]: readonly [string, string, string, string, number, number]) => {
    const pageData = await fetchPaymentsPage(
      em,
      true, // skip name lookup for speed in infinite scroll
      page,
      limit,
      status,
      type,
      "desc",
    );

    const normalized = pageData.map((r) => ({
      ...r,
      requestDate: toYMD(r.requestDate),
      absentDate: toYMD(r.absentDate),
    }));

    return normalized;
  }, []);

  const { data, error, size, setSize, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
  });

  // `data` is an array of pages, each page is an array of PaymentRequest
  const flatData = useMemo(() => (data ? data.flat() as PaymentRequest[] : []), [data]);

  const loadingInitial = !data && !error;
  const loadingMore = loadingInitial || (size > 0 && data && typeof data[size - 1] === "undefined");

  // Determine if we've reached the end by checking last page size
  const lastPageSize = data ? (data.at(-1)?.length ?? 0) : 0;
  const isReachingEnd = lastPageSize > 0 ? lastPageSize < pageSize : false;

  const loadMore = useCallback(() => {
    if (isReachingEnd) return;
    setSize(size + 1);
  }, [isReachingEnd, setSize, size]);

  const reset = useCallback(() => setSize(1), [setSize]);

  return {
    data: flatData,
    error,
    isLoading: loadingInitial,
    isLoadingMore: loadingMore,
    canLoadMore: !isReachingEnd,
    loadMore,
    reset,
    mutate,
  };
}
