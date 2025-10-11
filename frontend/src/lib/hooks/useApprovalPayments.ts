import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { paymentService } from "@/lib/services/paymentService";
import { usePaginatedData } from "./usePaginatedData";
import { PaymentRequest } from "@/lib/types/payment";

export function useApprovalPayments() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("대기");
  const [sortOrder, setSortOrder] = useState("desc");

  const updateStatusFilter = useCallback((filter: string) => {
    setStatusFilter(filter);

    const params = new URLSearchParams();
    if (filter !== "대기") {
      params.set('status', filter);
    }

    const queryString = params.toString();
    const url = queryString ? `/approval?${queryString}` : '/approval';
    router.replace(url, { scroll: false });
  }, [router])

  const updateSortOrder = useCallback((order: string) => {
    setSortOrder(order);
  }, []);

  const paginatedResult = usePaginatedData<PaymentRequest, { statusFilter: string; sortOrder: string; }>({ 
    queryKey: ["approvalPayments", { statusFilter, sortOrder }],
    queryFn: (params) => paymentService.getAdminPayments(params),
    filters: { statusFilter, sortOrder },
  });

  return {
    ...paginatedResult,
    statusFilter,
    sortOrder,
    setStatusFilter: updateStatusFilter,
    setSortOrder: updateSortOrder,
  };
}
