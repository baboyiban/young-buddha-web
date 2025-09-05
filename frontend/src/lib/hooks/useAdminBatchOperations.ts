import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { paymentService } from "@/lib/services/paymentService";
import { PaymentRequest } from "@/lib/types/payment";

export function useAdminBatchOperations() {
  const queryClient = useQueryClient();
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);

  const mutationOptions = {
    onSuccess: () => {
      // 'adminPayments'로 시작하는 모든 쿼리를 무효화하여 데이터 테이블을 새로고침합니다.
      queryClient.invalidateQueries({ queryKey: ["adminPayments"] });
      clearSelection();
    },
  };

  const singleUpdateMutation = useMutation({
    mutationFn: (variables: { request: PaymentRequest; status: string }) =>
      paymentService.updateStatus(variables.request.id, variables.status),
    ...mutationOptions,
  });

  const batchUpdateMutation = useMutation({
    mutationFn: (variables: { status: string }) => {
      const updates = selectedRequests.map((id) => ({
        id,
        status: variables.status,
      }));
      return paymentService.batchUpdateStatus(updates);
    },
    ...mutationOptions,
  });

  const handleSelectionChange = useCallback((items: string[]) => {
    setSelectedRequests(items);
    setIsAllSelected(false); // Assume not all are selected when changed manually
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

  return {
    selectedRequests,
    isAllSelected,
    // 여러 뮤테이션의 로딩 상태를 결합하거나, 특정 ID를 추적해야 할 수 있습니다.
    // 여기서는 간단하게 두 뮤테이션 중 하나라도 로딩 중이면 updatingId를 'batch'로 설정합니다.
    updatingId:
      singleUpdateMutation.isPending || batchUpdateMutation.isPending
        ? "batch"
        : null,

    onSelectionChange: handleSelectionChange,
    toggleSelectAll,
    clearSelection,
    handleBatchApprove: batchUpdateMutation.mutateAsync,
    handleSingleApprove: singleUpdateMutation.mutateAsync,
  };
}
