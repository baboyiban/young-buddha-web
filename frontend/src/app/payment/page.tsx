"use client";

// 개선된 Payment 페이지 예시
// app/payment/page.tsx (간소화된 버전)

import React from "react";
import PageLayout from "@/components/layouts/PageLayout";
import { FormField } from "@/components/forms/FormField";
import { useForm } from "@/lib/hooks/useForm";
import { useErrorHandler } from "@/lib/hooks/useErrorHandler";
import { PaymentRequest } from "@/lib/types/payment";
import { validatePaymentForm } from "@/lib/utils/validation";
import { OPTIONS, MESSAGES } from "@/lib/config/app";
import { usePaymentOperations } from "@/lib/hooks/usePaymentOperations";

export default function PaymentPageExample() {
  const { handleError, handleSuccess } = useErrorHandler();
  const { submitPayment } = usePaymentOperations();

  const initialValues: Partial<PaymentRequest> = {
    type: "정기",
    absentDate: "",
    schedule: "",
    reason: "",
  };

  const { values, errors, handleSubmit, setValue, isSubmitting, reset } =
    useForm({
      initialValues,
      validate: validatePaymentForm,
      onSubmit: async (formValues) => {
        try {
          await submitPayment(formValues as PaymentRequest, () => {
            handleSuccess(MESSAGES.SUCCESS.PAYMENT.SUBMITTED);
            reset();
          });
        } catch (error) {
          handleError(error, MESSAGES.ERRORS.PAYMENT.SUBMIT_FAILED);
        }
      },
    });

  return (
    <PageLayout title="결재 신청" requireAuth={true}>
      <div className="mx-[0.5rem] bg-white p-[1rem] rounded-xl">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-4">
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
    </PageLayout>
  );
}
