// components/approval/ApprovalBatchActions.tsx
import React from "react";
import LoadingButton from "@/components/LoadingButton";

interface ApprovalBatchActionsProps {
  selectedCount: number;
  isUpdating: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApprovalBatchActions({
  selectedCount,
  isUpdating,
  onApprove,
  onReject,
}: ApprovalBatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex gap-[0.25rem]">
      <LoadingButton
        loading={isUpdating}
        onClick={onApprove}
        variant="default"
        size="sm"
      >
        선택 {selectedCount}개 승인
      </LoadingButton>
      <LoadingButton
        loading={isUpdating}
        onClick={onReject}
        variant="destructive"
        size="sm"
      >
        선택 {selectedCount}개 반려
      </LoadingButton>
    </div>
  );
}