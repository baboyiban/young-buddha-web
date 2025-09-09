import React from "react";
import DataTable from "@/components/tables/DataTable";
import ActionButtons from "@/components/approval/ActionButtons";
import { formatDate, formatPaymentStatus } from "@/lib/utils/format";
import { APP_CONFIG } from "@/lib/config/app";
import { PaymentRequest } from "@/lib/types/payment";

// FIXME: Should be imported from a global types file
interface Column<T> {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
}

interface PaymentTableProps {
  requests: PaymentRequest[];
  loading: boolean;
  totalItems: number;
  currentPage: number;
  statusFilter: string;
  isAllSelected: boolean;
  selectedRequests: string[];
  updatingId: string | null;

  onPageChange: (page: number) => void;
  onSelectAll: (requests: PaymentRequest[]) => void;
  onSelectionChange: (items: string[]) => void; // Simplified for now
  onApproveAction: (item: PaymentRequest, status: string) => Promise<void>;
}

export default function PaymentTable({
  requests,
  loading,
  totalItems,
  currentPage,
  statusFilter,
  isAllSelected,
  selectedRequests,
  updatingId,
  onPageChange,
  onSelectAll,
  onSelectionChange,
  onApproveAction,
}: PaymentTableProps) {
  const columns: Column<PaymentRequest>[] = [
    { key: "email", header: "이메일" },
    { key: "userId", header: "아이디" },
    { key: "name", header: "이름" },
    { key: "type", header: "구분" },
    {
      key: "requestDate",
      header: "신청 날짜",
      render: (value) => formatDate(value as string, "short"),
    },
    {
      key: "absentDate",
      header: "불참일",
      render: (value) => formatDate(value as string, "short"),
    },
    { key: "schedule", header: "불참 일정" },
    { key: "reason", header: "사유" },
    {
      key: "approved",
      header: "결재 상태",
      render: (value) => formatPaymentStatus(value as string),
    },
    {
      key: "id",
      header: "관리",
      render: (_, item) => (
        <ActionButtons
          item={item}
          isUpdating={updatingId === item.id}
          onApprove={(status) => onApproveAction(item, status)}
        />
      ),
    },
  ];

  return (
    <DataTable
      data={requests as any}
      columns={columns as any}
      keyField="id"
      loading={loading}
      emptyMessage={
        statusFilter === "전체"
          ? "결재 신청이 없습니다."
          : `'${statusFilter}' 상태의 결재 신청이 없습니다.`
      }
      selection={{
        selectedItems: selectedRequests,
        onSelectionChange: onSelectionChange as (items: unknown[]) => void,
        isAllSelected,
        onSelectAll: () => onSelectAll(requests),
      }}
      pagination={{
        currentPage,
        totalPages:
          Math.ceil(totalItems / APP_CONFIG.PAGINATION.DEFAULT_SIZE) || 1,
        totalItems,
        itemsPerPage: APP_CONFIG.PAGINATION.DEFAULT_SIZE,
        onPageChange: onPageChange,
      }}
    />
  );
}
