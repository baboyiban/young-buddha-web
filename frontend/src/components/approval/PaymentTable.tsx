import React, { useCallback } from "react";
import { PaymentRequest } from "@/lib/types/payment";
import ApprovalTableRow from "./ApprovalTableRow";

interface PaymentTableProps {
  requests: PaymentRequest[];
  loading: boolean;
  totalItems: number;
  hasMore: boolean;
  statusFilter: string;
  isAllSelected: boolean;
  selectedRequests: string[];
  updatingId: string | null;

  onLoadMore: () => void;
  onSelectAll: (requests: PaymentRequest[]) => void;
  onSelectionChange: (items: string[]) => void;
  onApproveAction: (item: PaymentRequest, status: string) => Promise<void>;
}

export default function PaymentTable({
  requests,
  loading,
  totalItems,
  hasMore,
  statusFilter,
  isAllSelected,
  selectedRequests,
  updatingId,
  onLoadMore,
  onSelectAll,
  onSelectionChange,
  onApproveAction,
}: PaymentTableProps) {
  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <div className="text-dark-gray">로딩 중...</div>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex justify-center p-8">
        <div className="text-dark-gray">
          {statusFilter === "전체"
            ? "결재 신청이 없습니다."
            : `'${statusFilter}' 상태의 결재 신청이 없습니다.`}
        </div>
      </div>
    );
  }

  const handleToggleSelection = useCallback((id: string) => {
    const newSelection = selectedRequests.includes(id)
      ? selectedRequests.filter((i) => i !== id)
      : [...selectedRequests, id];
    onSelectionChange(newSelection);
  }, [selectedRequests, onSelectionChange]);

  return (
    <div className="flex flex-col items-center">
      <div className="table-wrapper w-fit max-w-full mb-[0.5rem]">
        <table className="w-full small">
          <thead>
            <tr>
              <th className="w-8">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={() => onSelectAll(requests)}
                  className="w-[0.75rem] h-[0.75rem]"
                />
              </th>
              <th>이메일</th>
              <th>아이디</th>
              <th>이름</th>
              <th>구분</th>
              <th>신청 날짜</th>
              <th>불참일</th>
              <th>불참 일정</th>
              <th>사유</th>
              <th>결재 상태</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((item) => (
              <ApprovalTableRow
                key={item.id}
                item={item}
                isSelected={selectedRequests.includes(item.id)}
                updatingId={updatingId}
                onSelectionChange={handleToggleSelection}
                onApproveAction={onApproveAction}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* 더보기 버튼 */}
      {hasMore && (
        <div className="mt-4">
          <button
            onClick={onLoadMore}
            className="button gray"
            disabled={loading}
          >
            {loading ? "로딩 중..." : `더보기 (${requests.length} / ${totalItems})`}
          </button>
        </div>
      )}


    </div>
  );
}
