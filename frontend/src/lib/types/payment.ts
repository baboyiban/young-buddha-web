// lib/types/payment.ts (개선된 버전)
export interface PaymentRequest {
  id: string;
  email: string;
  userId: string;
  name: string;
  requestDate: string; // ISO date string
  type: PaymentType;
  absentDate: string; // ISO date string
  schedule: string;
  reason: string;
  approved: PaymentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type PaymentType =
  | "정기"
  | "비정기"
  | "추가요청"
  | "사후알림"
  | "야근신청"
  | "기타";

export type PaymentStatus = "대기" | "승인" | "반려" | "";

export interface PaymentFilters {
  status?: PaymentStatus | "전체";
  type?: PaymentType | "전체";
  startDate?: string;
  endDate?: string;
  userId?: string;
}

export interface PaymentSortOptions {
  field: keyof PaymentRequest;
  order: "asc" | "desc";
}
