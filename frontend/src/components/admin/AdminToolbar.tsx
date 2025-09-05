import React from 'react';
import AdminFilters from '@/components/admin/AdminFilters';
import AdminBatchActions from '@/components/admin/AdminBatchActions';
import { PAYMENT_STATUS } from '@/lib/constants/payment';

interface AdminToolbarProps {
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

export default function AdminToolbar({
  statusFilter,
  sortOrder,
  loading,
  selectedCount,
  isUpdating,
  onStatusFilterChange,
  onSortOrderChange,
  onRefresh,
  onBatchAction
}: AdminToolbarProps) {
  return (
    <div className="flex justify-between items-center">
      <AdminFilters
        statusFilter={statusFilter}
        sortOrder={sortOrder}
        loading={loading}
        onStatusFilterChange={onStatusFilterChange}
        onSortOrderChange={onSortOrderChange}
        onRefresh={onRefresh}
      />
      <AdminBatchActions
        selectedCount={selectedCount}
        isUpdating={isUpdating}
        onApprove={() => onBatchAction(PAYMENT_STATUS.APPROVED)}
        onReject={() => onBatchAction(PAYMENT_STATUS.REJECTED)}
      />
    </div>
  );
}
