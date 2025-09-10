import { PaymentRequest } from "@/lib/types/payment";
import { OPTIONS } from "@/lib/config/app";
import { toYMD } from "@/lib/utils/dateUtils";

interface PaymentTableRowProps {
  request: PaymentRequest;
  isEditing: boolean;
  editForm: Partial<PaymentRequest>;
  deletingId: string | null;
  updating: boolean;
  isEditable?: boolean;
  onEditChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => void;
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
  isEditable = true,
  onEditChange,
  onEditStart,
  onEditCancel,
  onUpdate,
  onDelete,
}: PaymentTableRowProps) {
  return (
    <tr className="border-b">
      <td className="p-2">
        {isEditing ? (
          <select
            name="type"
            value={editForm.type ?? request.type}
            onChange={onEditChange}
            className="w-full p-1 border rounded"
          >
            {OPTIONS.PAYMENT.TYPES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          request.type
        )}
      </td>

      <td className="p-2">{toYMD(request.requestDate)}</td>
      <td className="p-2">
        {isEditing ? (
          <input
            type="date"
            name="absentDate"
            value={editForm.absentDate ?? request.absentDate}
            onChange={onEditChange}
            className="w-full p-1 border rounded"
          />
        ) : (
          request.absentDate
        )}
      </td>

      <td className="p-2">
        {isEditing ? (
          <input
            type="text"
            name="schedule"
            value={editForm.schedule ?? request.schedule}
            onChange={onEditChange}
            className="w-full p-1 border rounded"
          />
        ) : (
          request.schedule || "-"
        )}
      </td>

      <td className="p-2">
        {isEditing ? (
          <input
            type="text"
            name="reason"
            value={editForm.reason ?? request.reason}
            onChange={onEditChange}
            className="w-full p-1 border rounded"
          />
        ) : (
          request.reason || "-"
        )}
      </td>

      <td className="p-2">{request.approved || "대기"}</td>

       <td className="p-2 flex justify-center gap-2">
         {isEditing ? (
           <>
              <button
                onClick={() => onUpdate(request)}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                disabled={updating}
              >
                {updating ? "저장 중..." : "저장"}
              </button>
              <button onClick={onEditCancel} className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600" disabled={updating}>
                취소
              </button>
           </>
         ) : isEditable ? (
           <>
              <button
                onClick={() => onEditStart(request)}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:opacity-50"
                disabled={deletingId === request.id}
              >
                수정
              </button>
              <button
                onClick={() => onDelete(request)}
                className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 disabled:opacity-50"
                disabled={deletingId === request.id}
              >
                {deletingId === request.id ? "삭제 중..." : "삭제"}
              </button>
           </>
         ) : (
           <span>-</span>
         )}
       </td>
    </tr>
  );
}
