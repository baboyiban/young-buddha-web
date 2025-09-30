import React from 'react';
import { PaymentRequest } from '@/lib/types/payment';
import { formatDate, formatPaymentStatus } from '@/lib/utils/format';
import ActionButtons from './ActionButtons';

interface ApprovalTableRowProps {
  item: PaymentRequest;
  isSelected: boolean;
  updatingId: string | null;
  onSelectionChange: (id: string) => void;
  onApproveAction: (item: PaymentRequest, status: string) => Promise<void>;
}

function ApprovalTableRow({ 
  item, 
  isSelected, 
  updatingId,
  onSelectionChange,
  onApproveAction 
}: ApprovalTableRowProps) {
  return (
    <tr className={isSelected ? 'bg-blue-50' : ''}>
      <td>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelectionChange(item.id)}
          className="w-[0.75rem] h-[0.75rem]"
        />
      </td>
      <td>{item.email || '-'}</td>
      <td>{item.userId || '-'}</td>
      <td>{item.name || '-'}</td>
      <td>{item.type || '-'}</td>
      <td>{formatDate(item.requestDate, 'short')}</td>
      <td>{formatDate(item.absentDate, 'short')}</td>
      <td>{item.schedule || '-'}</td>
      <td>{item.reason || '-'}</td>
      <td>{formatPaymentStatus(item.approved)}</td>
      <td>
        <ActionButtons
          item={item}
          isUpdating={updatingId === item.id}
          onApprove={(status) => onApproveAction(item, status)}
        />
      </td>
    </tr>
  );
}

export default React.memo(ApprovalTableRow);
