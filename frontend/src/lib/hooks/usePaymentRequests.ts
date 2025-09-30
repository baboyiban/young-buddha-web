import { useState } from "react";
import { paymentService } from "@/lib/services/paymentService";
import { usePaginatedData } from "./usePaginatedData";
import { PaymentRequest } from "@/lib/types/payment";

export function usePaymentRequests(options: {
  email: string | undefined;
  typeFilter: string;
}) {
  const { email, typeFilter } = options;
  const [sortOrder, setSortOrder] = useState("desc");

  const paginatedResult = usePaginatedData<PaymentRequest, { email: string; typeFilter: string; sortOrder: string; }>({ 
    queryKey: ["paymentRequests", { email: email || "", typeFilter, sortOrder }],
    queryFn: (params) => paymentService.getUserPayments(params),
    filters: { email: email || "", typeFilter, sortOrder },
    options: { enabled: !!email },
  });

  return {
    ...paginatedResult,
    typeFilter,
    sortOrder,
    setSortOrder,
  };
}
