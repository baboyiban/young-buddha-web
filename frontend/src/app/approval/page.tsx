"use client"

import React, { useCallback } from "react";
import PageLayout from "@/components/layouts/PageLayout";
import ApprovalToolbar from "@/components/approval/ApprovalToolbar";
import PaymentTable from "@/components/approval/PaymentTable";
import { useApprovalPayments } from "@/lib/hooks/useApprovalPayments";
import { useApprovalBatchOperations } from "@/lib/hooks/useApprovalBatchOperations";
import { useErrorHandler } from "@/lib/hooks/useErrorHandler";
import { useConfirm } from "@/lib/hooks/useConfirm";
import { MESSAGES } from "@/lib/config/app";
import { PaymentRequest } from "@/lib/types/payment";

export default function ApprovalPage() {
  const { handleError, handleSuccess } = useErrorHandler();
  const { confirm, ConfirmDialog } = useConfirm();

  const {
    requests,
    loading,
    totalCount,
    error,
    statusFilter,
    sortOrder,
    hasMore,
    loadPayments,
    loadMore,
    setStatusFilter,
    setSortOrder,
  } = useApprovalPayments();

  // 페이지 마운트 시 및 데이터 변경 감지
  React.useEffect(() => {
    // 페이지 진입 시 항상 데이터 새로고침
    loadPayments();
    
    const handleStorageChange = () => {
      loadPayments();
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadPayments]);

  const {
    selectedRequests,
    isAllSelected,
    updatingId,
    onSelectionChange,
    toggleSelectAll,
    clearSelection,
    handleBatchApprove,
    handleSingleApprove,
  } = useApprovalBatchOperations(loadPayments);

  const handleApproveAction = useCallback(
    async (item: PaymentRequest, status: string) => {
      try {
        await handleSingleApprove({ request: item, status });
        handleSuccess(MESSAGES.SUCCESS.GENERIC);
        // 개별 승인 후에도 재검증 보장 (훅에서 이미 호출하지만 안전하게 한 번 더 호출 가능)
        await loadPayments();
      } catch (error) {
        handleError(error);
      }
    },
    [handleSingleApprove, handleSuccess, handleError, loadPayments],
  );

  const handleBatchAction = useCallback(
    async (status: string) => {
      if (selectedRequests.length === 0) {
        handleError(null, "처리할 항목을 선택해주세요.");
        return;
      }

      const confirmed = await confirm({
        title: "일괄 처리 확인",
        message: `선택된 ${selectedRequests.length}개 항목을 ${status} 처리하시겠습니까?`,
        type: "warning",
      });

      if (confirmed) {
        try {
          await handleBatchApprove({ status });
          handleSuccess(
            `${selectedRequests.length}개 항목이 ${status} 처리되었습니다.`,
          );
          await loadPayments(); // 일괄 처리 후 재검증
        } catch (error) {
          handleError(error, "일괄 처리 중 오류가 발생했습니다.");
        }
      }
    },
    [selectedRequests, confirm, handleBatchApprove, handleSuccess, handleError, loadPayments],
  );

  return (
    <>
      <PageLayout
        title="결재 관리"
        requireAuth={true}
        requiredRoles={["ADMIN"]}
        loading={loading}
        error={error}
      >
        <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl space-y-[0.75rem]">
          <ApprovalToolbar
            statusFilter={statusFilter}
            sortOrder={sortOrder}
            loading={loading}
            selectedCount={selectedRequests.length}
            isUpdating={!!updatingId}
            onStatusFilterChange={setStatusFilter}
            onSortOrderChange={setSortOrder}
            onRefresh={loadPayments}
            onBatchAction={handleBatchAction}
          />

           <PaymentTable
             requests={requests}
             loading={loading}
             totalItems={totalCount}
             hasMore={hasMore}
             statusFilter={statusFilter}
             isAllSelected={isAllSelected}
             selectedRequests={selectedRequests}
             updatingId={updatingId}
             onLoadMore={loadMore}
             onSelectAll={toggleSelectAll}
             onSelectionChange={onSelectionChange}
             onApproveAction={handleApproveAction}
           />
        </div>
      </PageLayout>
      <ConfirmDialog />
    </>
  );
}
