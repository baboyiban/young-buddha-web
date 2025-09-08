// lib/utils/validation.ts
import { APP_CONFIG } from "@/lib/config/app";
import { ValidationError } from "@/lib/types/api";
import { PaymentRequest } from "../types/payment";

export function validateEmail(email: string): boolean {
  return APP_CONFIG.VALIDATION.EMAIL_REGEX.test(email);
}

export function validatePaymentForm(
  form: Partial<PaymentRequest>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // email 검증은 submitPayment에서 user.email을 사용하므로 폼에서는 제외

  if (!form.absentDate || !isValidDate(form.absentDate)) {
    errors.push({
      field: "absentDate",
      message: "불참일을 선택해주세요.",
      code: "INVALID_DATE",
    });
  }

  if (
    form.reason &&
    form.reason.length < APP_CONFIG.VALIDATION.MIN_REASON_LENGTH
  ) {
    errors.push({
      field: "reason",
      message: `사유는 최소 ${APP_CONFIG.VALIDATION.MIN_REASON_LENGTH}자 이상 입력해주세요.`,
      code: "REASON_TOO_SHORT",
    });
  }

  if (
    form.reason &&
    form.reason.length > APP_CONFIG.VALIDATION.MAX_REASON_LENGTH
  ) {
    errors.push({
      field: "reason",
      message: `사유는 최대 ${APP_CONFIG.VALIDATION.MAX_REASON_LENGTH}자까지 입력 가능합니다.`,
      code: "REASON_TOO_LONG",
    });
  }

  if (
    form.schedule &&
    form.schedule.length > APP_CONFIG.VALIDATION.MAX_SCHEDULE_LENGTH
  ) {
    errors.push({
      field: "schedule",
      message: `일정은 최대 ${APP_CONFIG.VALIDATION.MAX_SCHEDULE_LENGTH}자까지 입력 가능합니다.`,
      code: "SCHEDULE_TOO_LONG",
    });
  }

  return errors;
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}
