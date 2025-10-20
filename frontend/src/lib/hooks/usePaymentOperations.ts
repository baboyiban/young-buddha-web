// hooks/usePaymentOperations.ts
import { useState } from "react";
import { mutate } from "swr";
import { PaymentRequest } from "@/lib/types/payment";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  fetchFilteredPayments,
  fetchPaymentsByQuery,
  getUserNameByEmail,
} from "@/lib/api/payment";
import {
  sheetsCreate,
  sheetsDelete,
  sheetsUpdate,
  escapeSheetQueryString,
} from "@/lib/api/sheets/client";
import { PAYMENT_SHEET } from "@/lib/constants/sheets";
import { toYMD, normalizeId, generateUniqueId } from "@/lib/utils/dateUtils";
import { ERROR_MESSAGES } from "../constants/payment";

export function usePaymentOperations() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitPayment = async (
    form: PaymentRequest,
    onSuccess?: () => void,
  ) => {
    if (!user?.email) return;

    try {
      setSubmitting(true);
      setError(null);

      const newId = generateUniqueId();
      const userName = await getUserNameByEmail(user.email);

      const newRow = [
        newId,
        user.email,
        user.email.split("@")[0],
        userName,
        form.type,
        toYMD(form.requestDate || new Date()),
        toYMD(form.absentDate),
        form.schedule,
        form.reason,
        "대기",
      ];

      await sheetsCreate(
        PAYMENT_SHEET.spreadsheetId,
        PAYMENT_SHEET.gid,
        `INSERT ${JSON.stringify(newRow)}`,
      );

      // 관련 캐시 모두 갱신 - 가장 확실한 방법
      mutate((key: any) => {
        // 모든 캐시 키 검사
        if (Array.isArray(key) && key.length > 0) {
          const firstKey = key[0];
          // paymentRequests 또는 approvalPayments 관련 모든 캐시 갱신
          if (typeof firstKey === "string") {
            return (
              firstKey.includes("paymentRequests") ||
              firstKey.includes("approvalPayments")
            );
          }
        }
        return false;
      });

      // 추가적으로 명시적으로 캐시 키 갱신 시도
      mutate("paymentRequests");
      mutate("approvalPayments");

      // 데이터 변경 알림을 위한 localStorage 이벤트
      localStorage.setItem("paymentDataUpdated", Date.now().toString());

      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (err) {
      setError(ERROR_MESSAGES.SUBMIT_FAILED);
    } finally {
      setSubmitting(false);
    }
  };

  const deletePayment = async (
    request: PaymentRequest,
    onSuccess?: () => void,
  ) => {
    if (!window.confirm(ERROR_MESSAGES.DELETE_CONFIRM)) return;
    if (deletingId) return;

    try {
      setDeletingId(request.id);
      setError(null);

      const normalizedId = normalizeId(request.id);
      const whereId = escapeSheetQueryString(normalizedId);
      const query = `SELECT * WHERE A = '${whereId}'`;

      await sheetsDelete(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.gid, query);

      // 관련 캐시 모두 갱신 - 더 강력한 방법
      mutate((key: any) => {
        // 모든 캐시 키 검사
        if (Array.isArray(key) && key.length > 0) {
          const firstKey = key[0];
          // paymentRequests 또는 approvalPayments 관련 모든 캐시 갱신
          if (typeof firstKey === "string") {
            return (
              firstKey.includes("paymentRequests") ||
              firstKey.includes("approvalPayments")
            );
          }
        }
        return false;
      });

      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (err) {
      setError(ERROR_MESSAGES.DELETE_FAILED);
    } finally {
      setDeletingId(null);
    }
  };

  const updatePayment = async (
    original: PaymentRequest,
    editForm: Partial<PaymentRequest>,
    requests: PaymentRequest[],
    onSuccess?: () => void,
  ) => {
    const existsLocally = requests.some((r) => r.id === original.id);
    if (!existsLocally) {
      setError(ERROR_MESSAGES.TARGET_NOT_FOUND);
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      const normalizedId = normalizeId(original.id);
      const whereId = escapeSheetQueryString(normalizedId);
      const userName = await getUserNameByEmail(original.email);

      const updatedRow = [
        normalizedId,
        original.email,
        original.userId,
        userName,
        editForm.type ?? original.type,
        toYMD(original.requestDate),
        toYMD(editForm.absentDate ?? original.absentDate),
        editForm.schedule ?? original.schedule,
        editForm.reason ?? original.reason,
        original.approved || "대기",
      ];

      let query = `UPDATE WHERE A = '${whereId}' VALUES ${JSON.stringify(updatedRow)}`;

      try {
        await sheetsUpdate(
          PAYMENT_SHEET.spreadsheetId,
          PAYMENT_SHEET.gid,
          query,
        );
      } catch (e) {
        const query2 = `UPDATE WHERE A = "${whereId}" VALUES ${JSON.stringify(updatedRow)}`;
        await sheetsUpdate(
          PAYMENT_SHEET.spreadsheetId,
          PAYMENT_SHEET.gid,
          query2,
        );
      }

      // 관련 캐시 모두 갱신 - 더 강력한 방법
      mutate((key: any) => {
        // 모든 캐시 키 검사
        if (Array.isArray(key) && key.length > 0) {
          const firstKey = key[0];
          // paymentRequests 또는 approvalPayments 관련 모든 캐시 갱신
          if (typeof firstKey === "string") {
            return (
              firstKey.includes("paymentRequests") ||
              firstKey.includes("approvalPayments")
            );
          }
        }
        return false;
      });

      if (typeof onSuccess === "function") {
        onSuccess();
      }
    } catch (err: any) {
      setError(`${ERROR_MESSAGES.UPDATE_FAILED}\n${err?.message || ""}`);
    } finally {
      setUpdating(false);
    }
  };

  return {
    submitting,
    updating,
    deletingId,
    error,
    setError,
    submitPayment,
    deletePayment,
    updatePayment,
  };
}
