import LoadingButton from "@/components/LoadingButton";
import { PAYMENT_TYPES } from "@/lib/constants/payment";
import { PaymentRequest } from "@/lib/types/payment";

interface PaymentFormProps {
  form: PaymentRequest;
  onFormChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
}

export default function PaymentForm({
  form,
  onFormChange,
  onSubmit,
  submitting,
}: PaymentFormProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSubmit(e);
  };

  return (
    <div className="mx-[0.5rem] p-[1rem] bg-white rounded-[1rem]">
      <form onSubmit={handleSubmit} className="flex justify-center">
        <div className="w-[60rem] flex flex-col space-y-[0.75rem]">
          <div className="flex flex-col gap-[0.25rem]">
            <label className="text-sm" htmlFor="type">
              결재 유형
            </label>
            <select
              id="type"
              name="type"
              value={form.type}
              onChange={onFormChange}
            >
              {PAYMENT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-[0.25rem]">
            <label className="text-sm" htmlFor="absentDate">
              불참일
            </label>
            <input
              type="date"
              id="absentDate"
              name="absentDate"
              value={form.absentDate}
              onChange={onFormChange}
              required
            />
          </div>

          <div className="flex flex-col gap-[0.25rem]">
            <label className="text-sm" htmlFor="schedule">
              불참 일정
            </label>
            <input
              type="text"
              id="schedule"
              name="schedule"
              value={form.schedule}
              onChange={onFormChange}
              placeholder="예) 청붓 일정 불참"
              className=""
            />
          </div>

          <div className="flex flex-col gap-[0.25rem]">
            <label className="text-sm" htmlFor="reason">
              사유
            </label>
            <textarea
              id="reason"
              name="reason"
              value={form.reason}
              onChange={onFormChange}
              placeholder="예) 불교대 반담당회의 (20:00-21:30)"
              rows={4}
            />
          </div>

          <LoadingButton
            type="submit"
            className="purple"
            loading={submitting}
            disabled={submitting}
          >
            결재 신청
          </LoadingButton>
        </div>
      </form>
    </div>
  );
}
