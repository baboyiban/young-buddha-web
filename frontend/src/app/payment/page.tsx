"use client";

// 개선된 Payment 페이지 예시
// app/payment/page.tsx (간소화된 버전)

import React from "react";
import useSWR from "swr";
import PageLayout from "@/components/layouts/PageLayout";
import { FormField } from "@/components/forms/FormField";
import { useForm } from "@/lib/hooks/useForm";
import { useErrorHandler } from "@/lib/hooks/useErrorHandler";
import { useAuth } from "@/lib/hooks/useAuth";
import { PaymentRequest } from "@/lib/types/payment";
import { validatePaymentForm } from "@/lib/utils/validation";
import { OPTIONS, MESSAGES } from "@/lib/config/app";
import { usePaymentOperations } from "@/lib/hooks/usePaymentOperations";
import { fetchFilteredPayments } from "@/lib/api/payment";
import { toYMD } from "@/lib/utils/dateUtils";
import PaymentTable from "./PaymentTable";

const initialValues: Partial<PaymentRequest> = {
  type: undefined,
  absentDate: "",
  schedule: "",
  reason: "",
};

export default function PaymentPageExample() {
  const { handleError, handleSuccess } = useErrorHandler();
  const { submitPayment, deletePayment, updatePayment, updating, deletingId } = usePaymentOperations();
  const { user } = useAuth();

  // PaymentTable에 필요한 상태들
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editForm, setEditForm] = React.useState<Partial<PaymentRequest>>({});
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage] = React.useState(10);
  const [typeFilter, setTypeFilter] = React.useState<"전체" | "정기" | "비정기">("전체");

  const fetcher = async ([key, email, page, filter]: [string, string, number, string]) => {
    const { data, totalCount } = await fetchFilteredPayments(email, false, page, itemsPerPage, filter, undefined, 'desc');
    const normalized = data.map((r) => ({
      ...r,
      requestDate: toYMD(r.requestDate),
      absentDate: toYMD(r.absentDate),
    }));
    return { data: normalized, totalCount };
  };

  const { data: payments, error: paymentsError, isLoading: paymentsLoading, mutate } = useSWR(
    user?.email ? ['payments', user.email, currentPage, typeFilter] : null,
    fetcher
  );

  const { values, errors, handleSubmit, setValue, isSubmitting, reset } =
    useForm({
      initialValues,
      validate: validatePaymentForm,
      onSubmit: async (formValues) => {
        try {
          await submitPayment(formValues as PaymentRequest, () => {
            handleSuccess(MESSAGES.SUCCESS.PAYMENT.SUBMITTED);
            reset();
            mutate(); // 데이터 새로고침
          });
        } catch (error) {
          handleError(error, MESSAGES.ERRORS.PAYMENT.SUBMIT_FAILED);
        }
      },
    });

  // PaymentTable 핸들러들
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditStart = (request: PaymentRequest) => {
    setEditingId(request.id);
    setEditForm({
      type: request.type,
      absentDate: request.absentDate,
      schedule: request.schedule,
      reason: request.reason,
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleUpdate = async (original: PaymentRequest) => {
    if (!payments?.data) return;
    try {
      await updatePayment(original, editForm, payments.data, () => {
        handleSuccess("결재 신청이 수정되었습니다.");
        setEditingId(null);
        setEditForm({});
        mutate(); // 데이터 새로고침
      });
    } catch (error) {
      handleError(error, "결재 신청 수정에 실패했습니다.");
    }
  };

  const handleDelete = async (request: PaymentRequest) => {
    try {
      await deletePayment(request, () => {
        handleSuccess("결재 신청이 삭제되었습니다.");
        mutate(); // 데이터 새로고침
      });
    } catch (error) {
      handleError(error, "결재 신청 삭제에 실패했습니다.");
    }
  };

  const handleTypeFilterChange = (type: "전체" | "정기" | "비정기") => {
    setTypeFilter(type);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로
  };

  return (
    <PageLayout title="결재 신청" requireAuth={true}>
      <div className="space-y-[0.5rem]">
        {/* 결재 신청 폼 */}
        <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl">
          <form onSubmit={handleSubmit} className="max-w-[60rem] mx-auto space-y-4">
            <FormField
              label="결재 유형"
              htmlFor="type"
              required
              error={errors.type}
            >
              <select
                id="type"
                value={values.type || ""}
                onChange={(e) => setValue("type", e.target.value)}
                className="w-full"
              >
                {OPTIONS.PAYMENT.TYPES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label="불참일"
              htmlFor="absentDate"
              required
              error={errors.absentDate}
            >
              <input
                type="date"
                id="absentDate"
                value={values.absentDate || ""}
                onChange={(e) => setValue("absentDate", e.target.value)}
                className="w-full"
              />
            </FormField>

            <FormField
              label="불참 일정"
              htmlFor="schedule"
              error={errors.schedule}
            >
              <input
                type="text"
                id="schedule"
                value={values.schedule || ""}
                onChange={(e) => setValue("schedule", e.target.value)}
                placeholder="예) 청붓 일정 불참"
                className="w-full"
              />
            </FormField>

            <FormField label="사유" htmlFor="reason" error={errors.reason}>
              <textarea
                id="reason"
                value={values.reason || ""}
                onChange={(e) => setValue("reason", e.target.value)}
                placeholder="예) 불교대 반담당회의 (20:00-21:30)"
                rows={4}
                className="w-full resize-none"
              />
            </FormField>

            <button
              type="submit"
              disabled={isSubmitting}
              className="button purple w-full"
            >
              {isSubmitting ? MESSAGES.LOADING.PAYMENT.SUBMITTING : "결재 신청"}
            </button>
          </form>
        </div>

        {/* 신청 현황 테이블 */}
        {paymentsLoading ? (
          <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl text-center">
            로딩 중...
          </div>
        ) : paymentsError ? (
          <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl text-center text-red-500">
            데이터를 불러오는데 실패했습니다.
          </div>
        ) : (
          <PaymentTable
            requests={payments?.data || []}
            totalCount={payments?.totalCount || 0}
            editingId={editingId}
            editForm={editForm}
            deletingId={deletingId}
            updating={updating}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            typeFilter={typeFilter}
            isEditable={true}
            onPageChange={handlePageChange}
            onEditChange={handleEditChange}
            onEditStart={handleEditStart}
            onEditCancel={handleEditCancel}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onTypeFilterChange={handleTypeFilterChange}
          />
        )}
      </div>
    </PageLayout>
  );
}
