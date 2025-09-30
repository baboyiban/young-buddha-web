"use client";

// 개선된 Payment 페이지 예시
// app/payment/page.tsx (간소화된 버전)

import React from "react";
import PageLayout from "@/components/layouts/PageLayout";
import { FormField } from "@/components/forms/FormField";
import { useForm } from "@/lib/hooks/useForm";
import { useErrorHandler } from "@/lib/hooks/useErrorHandler";
import { useAuth } from "@/lib/hooks/useAuth";
import { PaymentRequest } from "@/lib/types/payment";
import { validatePaymentForm } from "@/lib/utils/validation";
import { OPTIONS, MESSAGES } from "@/lib/config/app";
import { usePaymentOperations } from "@/lib/hooks/usePaymentOperations";
import PaymentTable from "./PaymentTable";
import { usePaymentRequests } from "@/lib/hooks/usePaymentRequests";

const initialValues: Partial<PaymentRequest> = {
  type: "비정기",
  requestDate: new Date().toISOString().slice(0, 10),
  absentDate: new Date().toISOString().slice(0, 10),
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
  const [itemsPerPage] = React.useState(10);
  const [typeFilter, setTypeFilter] = React.useState<"전체" | "정기" | "비정기">("전체");

  const { 
    requests, 
    loading, 
    hasMore, 
    loadMore, 
    loadPayments: mutate,
    totalCount
  } = usePaymentRequests({
    email: user?.email,
    typeFilter,
  });

  const { values, errors, handleSubmit, setValue, isSubmitting, reset: resetForm } =
    useForm({
      initialValues,
      validate: validatePaymentForm,
      onSubmit: async (formValues) => {
        try {
          await submitPayment(formValues as PaymentRequest, () => {
            handleSuccess(MESSAGES.SUCCESS.PAYMENT.SUBMITTED);
            resetForm();
            mutate(); // 데이터 새로고침
          });
        } catch (error) {
          handleError(error, MESSAGES.ERRORS.PAYMENT.SUBMIT_FAILED);
        }
      },
    });

  const handleEditChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }, []);

  const handleEditStart = React.useCallback((request: PaymentRequest) => {
    setEditingId(request.id);
    setEditForm({
      type: request.type,
      absentDate: request.absentDate,
      schedule: request.schedule,
      reason: request.reason,
    });
  }, []);

  const handleEditCancel = React.useCallback(() => {
    setEditingId(null);
    setEditForm({});
  }, []);

  const handleUpdate = React.useCallback(async (original: PaymentRequest) => {
    if (!requests) return;
    try {
      await updatePayment(original, editForm, requests, () => {
        handleSuccess("결재 신청이 수정되었습니다.");
        setEditingId(null);
        setEditForm({});
        mutate(); // 데이터 새로고침
      });
    } catch (error) {
      handleError(error, "결재 신청 수정에 실패했습니다.");
    }
  }, [requests, editForm, updatePayment, handleSuccess, handleError, mutate]);

  const handleDelete = React.useCallback(async (request: PaymentRequest) => {
    try {
      await deletePayment(request, () => {
        handleSuccess("결재 신청이 삭제되었습니다.");
        mutate(); // 데이터 새로고침
      });
    } catch (error) {
      handleError(error, "결재 신청 삭제에 실패했습니다.");
    }
  }, [deletePayment, handleSuccess, handleError, mutate]);

  const handleTypeFilterChange = React.useCallback((type: "전체" | "정기" | "비정기") => {
    setTypeFilter(type);
  }, []);

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
        {loading ? (
          <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl text-center">
            로딩 중...
          </div>
        ) : (
           <PaymentTable
             requests={requests || []}
             totalCount={totalCount || 0}
             editingId={editingId}
             editForm={editForm}
             deletingId={deletingId}
             updating={updating}
             currentPage={1}
             itemsPerPage={itemsPerPage}
             typeFilter={typeFilter}
             isEditable={true}
             onPageChange={() => {}}
             onEditChange={handleEditChange}
             onEditStart={handleEditStart}
             onEditCancel={handleEditCancel}
             onUpdate={handleUpdate}
             onDelete={handleDelete}
             onTypeFilterChange={handleTypeFilterChange}
             loadMore={loadMore}
             canLoadMore={hasMore}
             isLoadingMore={loading}
           />
        )}
      </div>
    </PageLayout>
  );
}
