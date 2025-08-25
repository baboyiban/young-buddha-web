import { PaymentRequest } from "@/lib/types/payment";
import PaymentTableRow from "./PaymentTableRow";
import Pagination from "@/components/Pagination";

interface PaymentTableProps {
  requests: PaymentRequest[];
  editingId: string | null;
  editForm: Partial<PaymentRequest>;
  deletingId: string | null;
  updating: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onEditChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
  onEditStart: (r: PaymentRequest) => void;
  onEditCancel: () => void;
  onUpdate: (original: PaymentRequest) => void;
  onDelete: (request: PaymentRequest) => void;
}

export default function PaymentTable({
  requests,
  editingId,
  editForm,
  deletingId,
  updating,
  currentPage,
  itemsPerPage,
  onPageChange,
  onEditChange,
  onEditStart,
  onEditCancel,
  onUpdate,
  onDelete,
}: PaymentTableProps) {
  // 현재 페이지에 표시할 데이터 계산
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageRequests = requests.slice(startIndex, endIndex);

  // 총 페이지 수 계산
  const totalPages = Math.ceil(requests.length / itemsPerPage) || 1;

  // 디버깅 정보
  console.log("PaymentTable:", {
    totalRequests: requests.length,
    currentPage,
    itemsPerPage,
    totalPages,
    startIndex,
    endIndex,
    currentPageRequestsLength: currentPageRequests.length,
  });

  if (requests.length === 0) {
    return (
      <div className="mx-[0.5rem] bg-white rounded-xl">
        <div className="p-[1rem] flex justify-center">
          <div className="text-gray-50">신청 현황이 없습니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-[0.5rem] bg-white rounded-xl">
      <div className="p-[1rem] flex flex-col space-y-[0.5rem] items-center">
        <div className="table-wrapper w-[60rem] max-w-full">
          <table className="max-w-full text-sm">
            <thead>
              <tr>
                <th className="">이메일</th>
                <th className="">아이디</th>
                <th className="">이름</th>
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
          totalItems={requests.length}
        />
      </div>
    </div>
  );
}
