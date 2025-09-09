// components/approval/ApprovalFilters.tsx
import React from "react";

interface ApprovalFiltersProps {
  statusFilter: string;
  sortOrder: string;
  loading: boolean;
  onStatusFilterChange: (filter: string) => void;
  onSortOrderChange: (order: string) => void;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  { value: "전체", label: "전체" },
  { value: "대기", label: "대기" },
  { value: "승인", label: "승인" },
  { value: "반려", label: "반려" },
];

const SORT_OPTIONS = [
  { value: "desc", label: "최신순" },
  { value: "asc", label: "오래된순" },
];

export default function ApprovalFilters({
  statusFilter,
  sortOrder,
  loading,
  onStatusFilterChange,
  onSortOrderChange,
  onRefresh,
}: ApprovalFiltersProps) {
  return (
    <div className="overflow-x-auto rounded-[1rem] flex space-x-[0.25rem]">
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        className="px-[0.5rem] py-[0.25rem] border rounded text-sm"
        disabled={loading}
      >
        {STATUS_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={sortOrder}
        onChange={(e) => onSortOrderChange(e.target.value)}
        className="px-[0.5rem] py-[0.25rem] border rounded text-sm"
        disabled={loading}
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <button onClick={onRefresh} className="button gray" disabled={loading}>
        {loading ? "새로고침 중..." : "새로고침"}
      </button>
    </div>
  );
}
