import { useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { paymentService } from "@/lib/services/paymentService";
import { usePaginatedData } from "./usePaginatedData";
import { PaymentRequest } from "@/lib/types/payment";

export function useApprovalPayments() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlStatus = searchParams.get('status');
  const [statusFilter, setStatusFilter] = useState(urlStatus || "대기");
  const [sortOrder, setSortOrder] = useState("desc");

  const updateStatusFilter = useCallback((filter: string) => {
    setStatusFilter(filter);

    const params = new URLSearchParams(searchParams.toString());
    if (filter === "대기") {
      params.delete('status');
    } else {
      params.set('status', filter);
    }

    router.replace(`/approval?${params.toString()}`, { scroll: false });
  }, [searchParams, router])

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
