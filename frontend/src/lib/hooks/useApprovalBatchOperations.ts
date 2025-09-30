import { useState, useCallback } from "react";
import { paymentService } from "@/lib/services/paymentService";
import { PaymentRequest } from "@/lib/types/payment";

export function useApprovalBatchOperations(onUpdated?: () => Promise<void> | void) {
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSelectionChange = useCallback((items: string[]) => {
    setSelectedRequests(items);
    setIsAllSelected(false);
  }, []);

  const toggleSelectAll = useCallback(
    (requests: PaymentRequest[]) => {
      if (isAllSelected) {
        setSelectedRequests([]);
      } else {
        setSelectedRequests(requests.map((r) => r.id));
      }
      setIsAllSelected(!isAllSelected);
    },
    [isAllSelected],
  );

  const clearSelection = useCallback(() => {
    setSelectedRequests([]);
    setIsAllSelected(false);
  }, []);

  const handleSingleApprove = useCallback(
    async ({ request, status }: { request: PaymentRequest; status: string }) => {
      setIsPending(true);
      try {
        await paymentService.updateStatus(request.id, status);
        clearSelection();
        await onUpdated?.();
      } finally {
        setIsPending(false);
      }
    },
    [clearSelection, onUpdated],
  );

  const handleBatchApprove = useCallback(
    async ({ status }: { status: string }) => {
      setIsPending(true);
      try {
        const updates = selectedRequests.map((id) => ({ id, status }));
        await paymentService.batchUpdateStatus(updates);
        clearSelection();
        await onUpdated?.();
      } finally {
        setIsPending(false);
      }
    },
    [selectedRequests, clearSelection, onUpdated],
  );

  return {
    selectedRequests,
    isAllSelected,
    updatingId: isPending ? "batch" : null,
    onSelectionChange: handleSelectionChange,
    toggleSelectAll,
    clearSelection,
    handleBatchApprove,
    handleSingleApprove,
  };
}
