import React from 'react';
import ApprovalFilters from '@/components/approval/ApprovalFilters';
import ApprovalBatchActions from '@/components/approval/ApprovalBatchActions';
import { PAYMENT_STATUS } from '@/lib/constants/payment';

interface ApprovalToolbarProps {
  statusFilter: string;
  sortOrder: string;
  loading: boolean;
  selectedCount: number;
  isUpdating: boolean;
  onStatusFilterChange: (value: string) => void;
  onSortOrderChange: (value: string) => void;
  onRefresh: () => void;
  onBatchAction: (status: string) => void;
}

export default function ApprovalToolbar({
  statusFilter,
  sortOrder,
  loading,
  selectedCount,
  isUpdating,
  onStatusFilterChange,
  onSortOrderChange,
  onRefresh,
  onBatchAction
}: ApprovalToolbarProps) {
  return (
    <div className="flex justify-between items-center">
      <ApprovalFilters
        statusFilter={statusFilter}
        sortOrder={sortOrder}
        loading={loading}
        onStatusFilterChange={onStatusFilterChange}
        onSortOrderChange={onSortOrderChange}
        onRefresh={onRefresh}
      />
      <ApprovalBatchActions
        selectedCount={selectedCount}
        isUpdating={isUpdating}
        onApprove={() => onBatchAction(PAYMENT_STATUS.APPROVED)}
        onReject={() => onBatchAction(PAYMENT_STATUS.REJECTED)}
      />
    </div>
  );
}
