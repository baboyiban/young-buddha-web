import { PaymentRequest } from "@/lib/types/payment";
import PaymentTableRow from "./PaymentTableRow";
import Pagination from "@/components/Pagination";

interface PaymentTableProps {
  requests: PaymentRequest[];
  totalCount: number;
  editingId: string | null;
  editForm: Partial<PaymentRequest>;
  deletingId: string | null;
  updating: boolean;
  currentPage: number;
  itemsPerPage: number;
  typeFilter: "전체" | "정기" | "비정기";
  onPageChange: (page: number) => void;
  onEditChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onEditStart: (r: PaymentRequest) => void;
  onEditCancel: () => void;
  onUpdate: (original: PaymentRequest) => void;
  onDelete: (request: PaymentRequest) => void;
  onTypeFilterChange: (type: "전체" | "정기" | "비정기") => void;
}

export default function PaymentTable({
  requests,
  totalCount,
  editingId,
  editForm,
  deletingId,
  updating,
  currentPage,
  itemsPerPage,
  typeFilter,
  onPageChange,
  onEditChange,
  onEditStart,
  onEditCancel,
  onUpdate,
  onDelete,
  onTypeFilterChange,
}: PaymentTableProps) {
  // 서버에서 이미 페이지네이션 및 필터링된 데이터를 받아왔으므로 추가 슬라이스 불필요
  // requests는 현재 페이지의 데이터만 포함함
  const currentPageRequests = requests;

  // 총 페이지 수 계산 (서버 사이드 페이지네이션을 위해 totalCount 사용)
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;

  if (requests.length === 0) {
    return (
      <div className="mx-[0.5rem] bg-white rounded-[1rem]">
        <div className="p-[1rem] flex flex-col items-center">
          {/* 타입 필터 선택 UI - admin 페이지 스타일 참고 */}
          <div className="flex gap-[0.5rem] mb-[1rem] self-start">
            <select
              value={typeFilter}
              onChange={(e) => onTypeFilterChange(e.target.value as "전체" | "정기" | "비정기")}
              className="px-[0.5rem] py-[0.25rem] border rounded text-sm"
            >
              <option value="전체">전체</option>
              <option value="정기">정기</option>
              <option value="비정기">비정기</option>
            </select>
          </div>
          <div className="text-gray-50">신청 현황이 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-[0.5rem] bg-white rounded-[1rem] flex flex-col items-center">
      <div className="m-[1rem] flex flex-col space-y-[0.75rem] items-center w-[60rem] max-w-full">
        {/* 타입 필터 선택 UI - admin 페이지 스타일 참고 */}
        <div className="flex gap-[0.5rem] self-start">
          <select
            value={typeFilter}
            onChange={(e) => onTypeFilterChange(e.target.value as "전체" | "정기" | "비정기")}
            className="border rounded text-sm"
          >
            <option value="전체">전체</option>
            <option value="정기">정기</option>
            <option value="비정기">비정기</option>
          </select>
        </div>

        {/* 모든 신청 현황을 하나의 테이블로 표시 (서버에서 이미 필터링됨) */}
        <div className="table-wrapper w-[60rem] max-w-full">
          <table className="max-w-full text-sm">
            <thead>
              <tr>
                <th className="">구분</th>
                <th className="">신청 날짜</th>
                <th className="">불참일</th>
                <th className="">불참 일정</th>
                <th className="">사유</th>
                <th className="">결재 상태</th>
                <th className="">관리</th>
              </tr>
            </thead>
            <tbody>
              {currentPageRequests.map((request) => (
                <PaymentTableRow
                  key={request.id}
                  request={request}
                  isEditing={editingId === request.id}
                  editForm={editForm}
                  deletingId={deletingId}
                  updating={updating}
                  onEditChange={onEditChange}
                  onEditStart={onEditStart}
                  onEditCancel={onEditCancel}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 컴포넌트 */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
          itemsPerPage={itemsPerPage}
          totalItems={totalCount}
        />
      </div>
    </div>
  );
}