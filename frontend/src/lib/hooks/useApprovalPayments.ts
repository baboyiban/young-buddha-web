import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { paymentService } from "@/lib/services/paymentService";
import { PaymentRequest } from "@/lib/types/payment";

export function useApprovalPayments() {
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("대기");
  const [sortOrder, setSortOrder] = useState("desc");

  const queryKey = ["approvalPayments", { currentPage, statusFilter, sortOrder }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      paymentService.getAdminPayments({ currentPage, statusFilter, sortOrder }),
    placeholderData: (previousData) => previousData,
    retry: 1,
  });

  const handleSetStatusFilter = useCallback((filter: string) => {
    setStatusFilter(filter);
    setCurrentPage(1); // 필터 변경 시 1페이지로 리셋
  }, []);

  return {
    requests: data?.data || [],
    totalItems: data?.totalCount || 0,
    loading: isLoading,
    error: error ? (error as Error).message : null,

    currentPage,
    statusFilter,
    sortOrder,

    loadPayments: refetch,
    setCurrentPage,
    setStatusFilter: handleSetStatusFilter,
    setSortOrder,
    clearError: () => {}, // React Query가 에러 상태를 관리하므로 더 이상 필요하지 않음
  };
}
