"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { fetchPaymentsByQuery } from "@/lib/api/payment";
import { escapeSheetQueryString } from "@/lib/api/sheets/client";
import { PaymentRequest } from "@/lib/types/payment";
import { usePaymentOperations } from "@/lib/hooks/usePaymentOperations";
import { toYMD, shortDate } from "@/lib/utils/dateUtils";
import ErrorMessage from "@/components/ErrorMessage";
import PaymentForm from "./PaymentForm";
import PaymentTable from "./PaymentTable";

export default function PaymentPage() {
  const { user, loading: authLoading } = useAuth();
  const {
    submitting,
    updating,
    deletingId,
    error,
    setError,
    submitPayment,
    deletePayment,
    updatePayment,
  } = usePaymentOperations();

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PaymentRequest>>({});

  // 페이지네이션 상태 추가
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // 테스트를 위해 3개로 설정 (나중에 10으로 변경)

  const [form, setForm] = useState<PaymentRequest>({
    id: "",
    email: "",
    userId: "",
    name: "",
    requestDate: shortDate(new Date()),
    type: "정기",
    absentDate: shortDate(new Date()),
    schedule: "",
    reason: "",
    approved: "",
  });

  useEffect(() => {
    if (!authLoading && user) {
      setForm((prev) => ({
        ...prev,
        email: user.email || "",
        userId: user.email?.split("@")[0] || "",
        name: user.name || "",
      }));
    }
  }, [authLoading, user]);

  const loadPayments = async () => {
    if (authLoading || !user?.email) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const safeEmail = escapeSheetQueryString(user.email);
      const data = await fetchPaymentsByQuery(
        `SELECT * WHERE B = '${safeEmail}' AND J = '대기'`,
      );
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);

      // 데이터가 로드되면 첫 페이지로 리셋
      setCurrentPage(1);
    } catch (err) {
      console.error("Failed to load payments:", err);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [user, authLoading]);

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // 편집 중이면 편집을 취소
    if (editingId) {
      handleEditCancel();
    }
  };

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await submitPayment(form, () => {
        loadPayments();
        setForm((prev) => ({
          ...prev,
          type: "정기",
          absentDate: shortDate(new Date()),
          schedule: "",
          reason: "",
        }));
      });
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  const handleDelete = async (request: PaymentRequest) => {
    await deletePayment(request, () => {
      loadPayments();
      // 현재 페이지에 아이템이 없으면 이전 페이지로 이동
      const totalPages = Math.ceil((requests.length - 1) / itemsPerPage);
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
      }
    });
  };

  const handleEditStart = (r: PaymentRequest) => {
    setEditingId(r.id);
    setEditForm({
      type: r.type,
      absentDate: r.absentDate,
      schedule: r.schedule,
      reason: r.reason,
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleUpdate = async (original: PaymentRequest) => {
    if (!editingId) return;
    await updatePayment(original, editForm, requests, () => {
      loadPayments();
      handleEditCancel();
    });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-52px-0.5rem)]">
      <div className="flex flex-col gap-[0.5rem]">
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        <PaymentForm
          form={form}
          onFormChange={handleFormChange}
          onSubmit={handleSubmit}
          submitting={submitting}
        />

        <PaymentTable
          requests={requests}
          editingId={editingId}
          editForm={editForm}
          deletingId={deletingId}
          updating={updating}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={handlePageChange}
          onEditChange={handleEditChange}
          onEditStart={handleEditStart}
          onEditCancel={handleEditCancel}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
