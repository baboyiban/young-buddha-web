import { useState } from "react";
import { paymentService } from "@/lib/services/paymentService";
import { usePaginatedData } from "./usePaginatedData";
import { PaymentRequest } from "@/lib/types/payment";

export function useApprovalPayments() {
  const [statusFilter, setStatusFilter] = useState("대기");
  const [sortOrder, setSortOrder] = useState("desc");

  const paginatedResult = usePaginatedData<PaymentRequest, { statusFilter: string; sortOrder: string; }>({ 
    queryKey: ["approvalPayments", { statusFilter, sortOrder }],
    queryFn: (params) => paymentService.getAdminPayments(params),
    filters: { statusFilter, sortOrder },
  });

  return {
    ...paginatedResult,
    statusFilter,
    sortOrder,
    setStatusFilter,
    setSortOrder,
  };
}