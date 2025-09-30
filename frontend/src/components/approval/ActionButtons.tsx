import { PAYMENT_STATUS } from '@/lib/constants/payment';
import { PaymentRequest } from '@/lib/types/payment';

interface ActionButtonsProps {
  item: PaymentRequest;
  isUpdating: boolean;
  onApprove: (status: string) => void;
}

export default function ActionButtons({ item, isUpdating, onApprove }: ActionButtonsProps) {
  if (item.approved === PAYMENT_STATUS.APPROVED) {
    return (
      <button
        onClick={() => onApprove(PAYMENT_STATUS.PENDING)}
        className="button small gray"
        disabled={isUpdating}
      >
        {isUpdating ? '처리 중...' : '승인 취소'}
      </button>
    );
  }

  if (item.approved === PAYMENT_STATUS.REJECTED) {
    return (
      <button
        onClick={() => onApprove(PAYMENT_STATUS.PENDING)}
        className="button small gray"
        disabled={isUpdating}
      >
        {isUpdating ? '처리 중...' : '반려 취소'}
      </button>
    );
  }

  return (
    <div className="flex space-x-[0.25rem]">
      <button
        onClick={() => onApprove(PAYMENT_STATUS.APPROVED)}
        className="button small purple"
        disabled={isUpdating}
      >
        {isUpdating ? '처리 중...' : '승인'}
      </button>
      <button
        onClick={() => onApprove(PAYMENT_STATUS.REJECTED)}
        className="button small red"
        disabled={isUpdating}
      >
        {isUpdating ? '처리 중...' : '반려'}
      </button>
    </div>
  );
}
