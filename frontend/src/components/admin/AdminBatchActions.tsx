// components/admin/AdminBatchActions.tsx
import React from "react";
import LoadingButton from "@/components/LoadingButton";

interface AdminBatchActionsProps {
  selectedCount: number;
  isUpdating: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export default function AdminBatchActions({
  selectedCount,
  isUpdating,
  onApprove,
  onReject,
}: AdminBatchActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex gap-[0.25rem]">
      <LoadingButton
        loading={isUpdating}
        onClick={onApprove}
        className="text-sm purple"
      >
        선택 {selectedCount}개 승인
      </LoadingButton>
      <LoadingButton
        loading={isUpdating}
        onClick={onReject}
        className="text-sm red"
      >
        선택 {selectedCount}개 반려
      </LoadingButton>
    </div>
  );
}
