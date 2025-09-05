export const PAYMENT_STATUS = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// 결재 유형 옵션 (Form/Row에서 사용)
export const PAYMENT_TYPES = [
  { value: "정기", label: "정기" },
  { value: "비정기", label: "비정기" },
  { value: "추가요청", label: "추가요청" },
  { value: "사후알림", label: "사후알림" },
  { value: "야근신청", label: "야근신청" },
  { value: "기타", label: "기타" },
] as const;

// 에러 메시지 (usePaymentOperations에서 사용)
export const ERROR_MESSAGES = {
  SUBMIT_FAILED: "결재 신청에 실패했습니다.",
  DELETE_CONFIRM: "정말로 삭제하시겠습니까?",
  DELETE_FAILED: "삭제 중 오류가 발생했습니다.",
  UPDATE_FAILED: "수정 중 오류가 발생했습니다.",
  TARGET_NOT_FOUND: "대상 항목을 찾을 수 없습니다.",
};
