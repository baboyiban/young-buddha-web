import { PaymentRequest } from "@/lib/types/payment";
import PaymentTableRow from "./PaymentTableRow";

interface PaymentTableProps {
  requests: PaymentRequest[];
  editingId: string | null;
  editForm: Partial<PaymentRequest>;
  deletingId: string | null;
  updating: boolean;
  onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
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
  onEditChange,
  onEditStart,
  onEditCancel,
  onUpdate,
  onDelete,
}: PaymentTableProps) {
  if (requests.length === 0) {
    return (
      <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl flex justify-center">
        <div className="text-dark-gray">신청 현황이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl flex justify-center">
      <div className="table-wrapper w-[60rem]">
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
            {requests.map((request) => (
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
    </div>
  );
}