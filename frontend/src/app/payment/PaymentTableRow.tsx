import { PaymentRequest } from "@/lib/types/payment";
import { PAYMENT_TYPES } from "@/lib/constants/payment";
import { toYMD } from "@/lib/utils/dateUtils";

interface PaymentTableRowProps {
  request: PaymentRequest;
  isEditing: boolean;
  editForm: Partial<PaymentRequest>;
  deletingId: string | null;
  updating: boolean;
  onEditChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onEditStart: (r: PaymentRequest) => void;
  onEditCancel: () => void;
  onUpdate: (original: PaymentRequest) => void;
  onDelete: (request: PaymentRequest) => void;
}

export default function PaymentTableRow({
  request,
  isEditing,
  editForm,
  deletingId,
  updating,
  onEditChange,
  onEditStart,
  onEditCancel,
  onUpdate,
  onDelete,
}: PaymentTableRowProps) {
  return (
    <tr className="">
      <td className="">{request.email}</td>
      <td className="">{request.userId}</td>
      <td className="">{request.name}</td>
      <td className="">
        {isEditing ? (
          <select
            name="type"
            value={editForm.type ?? request.type}
            onChange={onEditChange}
            className="text-sm"
          >
            {PAYMENT_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          request.type
        )}
      </td>

      <td className="">{toYMD(request.requestDate)}</td>
      <td className="">
        {isEditing ? (
          <input
            type="date"
            name="absentDate"
            value={editForm.absentDate ?? request.absentDate}
            onChange={onEditChange}
            className="text-sm"
          />
        ) : (
          request.absentDate
        )}
      </td>

      <td className="">
        {isEditing ? (
          <input
            type="text"
            name="schedule"
            value={editForm.schedule ?? request.schedule}
            onChange={onEditChange}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          />
        ) : (
          request.schedule || "-"
        )}
      </td>

      <td className="">
        {isEditing ? (
          <input
            type="text"
            name="reason"
            value={editForm.reason ?? request.reason}
            onChange={onEditChange}
            className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
          />
        ) : (
          request.reason || "-"
        )}
      </td>

      <td className="">{request.approved || "대기"}</td>

      <td className="flex justify-center gap-[0.25rem]">
        {isEditing ? (
          <>
            <button
              onClick={() => onUpdate(request)}
              className="text-sm purple"
              disabled={updating}
            >
              {updating ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={onEditCancel}
              className="text-sm gray"
              disabled={updating}
            >
              취소
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEditStart(request)}
              className="text-sm purple"
              disabled={deletingId === request.id}
            >
              수정
            </button>
            <button
              onClick={() => onDelete(request)}
              className="text-sm red"
              disabled={deletingId === request.id}
            >
              {deletingId === request.id ? "삭제 중..." : "삭제"}
            </button>
          </>
        )}
      </td>
    </tr>
  );
}