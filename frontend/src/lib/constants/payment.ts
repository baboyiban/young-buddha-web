export const PAYMENT_TYPES = [
  { value: "정기", label: "정기" },
  { value: "비정기", label: "비정기" },
  { value: "추가요청", label: "추가요청" },
  { value: "사후알림", label: "사후알림" },
  { value: "야근신청", label: "야근신청" },
  { value: "기타", label: "기타" },
] as const;

export const ERROR_MESSAGES = {
  SUBMIT_FAILED: "결재 신청에 실패했습니다.",
  DELETE_FAILED: "삭제 중 오류가 발생했습니다.",
  UPDATE_FAILED: "수정 중 오류가 발생했습니다.",
  DELETE_CONFIRM: "정말로 이 신청을 삭제하시겠습니까?",
  TARGET_NOT_FOUND: "업데이트 대상이 현재 로드된 신청 목록에 없습니다.",
} as const;