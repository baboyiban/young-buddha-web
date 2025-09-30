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

  const {
    selectedRequests,
    isAllSelected,
    updatingId,
    onSelectionChange,
    toggleSelectAll,
    clearSelection,
    handleBatchApprove,
    handleSingleApprove,
  } = useApprovalBatchOperations();

  const handleApproveAction = useCallback(
    async (item: PaymentRequest, status: string) => {
      try {
        await handleSingleApprove({ request: item, status });
        handleSuccess(MESSAGES.SUCCESS.GENERIC);
      } catch (error) {
        handleError(error);
      }
    },
    [handleSingleApprove, handleSuccess, handleError],
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
        } catch (error) {
          handleError(error, "일괄 처리 중 오류가 발생했습니다.");
        }
      }
    },
    [selectedRequests, confirm, handleBatchApprove, handleSuccess, handleError],
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
