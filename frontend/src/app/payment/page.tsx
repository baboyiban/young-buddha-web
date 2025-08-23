"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoadingButton from "@/components/LoadingButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import { fetchFilteredPayments } from "@/lib/api/payment";
import {
  sheetsCreate,
  sheetsDelete,
  sheetsUpdate,
  escapeSheetQueryString,
} from "@/lib/api/sheets/client";
import { PAYMENT_SHEET } from "@/lib/constants/sheets";
import { PaymentRequest } from "@/types/payment";

// 날짜를 항상 'YYYY-MM-DD'로 정규화
function toYMD(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // ISO/일반 파싱
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return shortDate(dt);
    // 예: 8/23/2025, 9:00:00 AM
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const y = parseInt(m[3], 10);
      const mo = parseInt(m[1], 10) - 1;
      const d = parseInt(m[2], 10);
      return shortDate(new Date(y, mo, d));
    }
    return s;
  }
  if (v instanceof Date) return shortDate(v);
  if (typeof v === "number") {
    // Google Sheets serial number 지원(1899-12-30 기준)
    const base = Date.UTC(1899, 11, 30);
    const ms = base + v * 86400000;
    return shortDate(new Date(ms));
  }
  return String(v);
}

function generateUniqueId(): string {
  return `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

// 추가: id 정규화 헬퍼
function normalizeId(id: string): string {
  return String(id)
    .trim()
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .normalize("NFKC");
}

function shortDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function PaymentPage() {
  // 상태 관리
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PaymentRequest>>({});

  // 폼 상태
  const [form, setForm] = useState<PaymentRequest>({
    id: "",
    name: "",
    requestDate: shortDate(new Date()),
    type: "정기",
    absentDate: shortDate(new Date()),
    schedule: "",
    reason: "",
    approved: "",
  });

  // 인증 상태 초기화
  useEffect(() => {
    if (!authLoading && user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || "",
      }));
    }
  }, [authLoading, user]);

  // 결재 요청 데이터 로딩
  useEffect(() => {
    const loadPayments = async () => {
      // 인증 로딩 중이면 대기
      if (authLoading) return;

      // 사용자 정보가 없으면 로딩 종료하고 종료
      if (!user?.name) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await fetchFilteredPayments(user.name);
        const normalized = data.map((r: PaymentRequest) => ({
          ...r,
          requestDate: toYMD(r.requestDate),
          absentDate: toYMD(r.absentDate),
        }));
        setRequests(normalized);
      } catch (err) {
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, [user, authLoading]);

  // 폼 값 변경 핸들러
  const handleChange = (
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

  // 결재 신청 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.name) return;

    try {
      setSubmitting(true);

      const newId = generateUniqueId();
      const newRow = [
        newId,
        user.name,
        form.type,
        toYMD(form.requestDate),
        toYMD(form.absentDate),
        form.schedule,
        form.reason,
        "대기",
      ];

      await sheetsCreate(
        PAYMENT_SHEET.spreadsheetId,
        PAYMENT_SHEET.sheetName,
        `INSERT ${JSON.stringify(newRow)}`,
      );

      // 신청 후 목록 갱신
      const data = await fetchFilteredPayments(user.name);
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);

      // 폼 초기화
      setForm((prev) => ({
        ...prev,
        type: "정기",
        absentDate: shortDate(new Date()),
        reason: "",
      }));
    } catch (err) {
      alert("결재 신청에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 삭제 상태 관리
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 삭제 핸들러
  const handleDelete = async (request: PaymentRequest) => {
    if (!window.confirm("정말로 이 신청을 삭제하시겠습니까?")) return;
    if (deletingId) return;

    try {
      setDeletingId(request.id);

      const normalizedId = normalizeId(request.id);
      const whereId = escapeSheetQueryString(normalizedId);

      const query = `SELECT * WHERE A = '${whereId}'`;

      // 디버그
      console.log("DEBUG[delete] sheet:", PAYMENT_SHEET);
      console.log("DEBUG[delete] original.id:", request.id, "len:", String(request.id).length);
      console.log(
        "DEBUG[delete] codepoints:",
        Array.from(String(request.id)).map((c) => c.charCodeAt(0))
      );
      console.log("DEBUG[delete] normalizedId:", normalizedId, "len:", normalizedId.length);
      console.log("DEBUG[delete] query:", query);

      await sheetsDelete(
        PAYMENT_SHEET.spreadsheetId,
        PAYMENT_SHEET.sheetName,
        query,
      );

      const data = await fetchFilteredPayments(user?.name || "");
      const normalizedRows = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalizedRows);
    } catch (err) {
      console.error("handleDelete error:", err);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  // 수정 시작 핸들러
  const handleEditStart = (r: PaymentRequest) => {
    setEditingId(r.id);
    setEditForm({
      type: r.type,
      absentDate: r.absentDate,
      schedule: r.schedule,
      reason: r.reason,
    });
  };

  // 수정 취소 핸들러
  const handleEditCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  // 수정 제출 핸들러
  const handleUpdate = async (original: PaymentRequest) => {
    if (!editingId) return;

    // 진단 로그
    console.log("DEBUG[update] current request ids:", requests.map((r) => r.id));
    console.log("DEBUG[update] updating id:", original.id);

    const existsLocally = requests.some((r) => r.id === original.id);
    if (!existsLocally) {
      console.error("업데이트 대상 id가 클라이언트에서 발견되지 않음:", original.id);
      alert("업데이트 대상이 현재 로드된 신청 목록에 없습니다. 시트의 ID 열(A열)이 변경되었는지 확인하세요.");
      return;
    }

    try {
      setUpdating(true);

      const normalizedId = normalizeId(original.id);
      const whereId = escapeSheetQueryString(normalizedId);

      const updatedRow = [
        normalizedId, // A: id는 정규화된 값으로 고정
        original.name, // B
        editForm.type ?? original.type, // C
        toYMD(original.requestDate), // D
        toYMD(editForm.absentDate ?? original.absentDate), // E
        editForm.schedule ?? original.schedule, // F
        editForm.reason ?? original.reason, // G
        original.approved || "대기", // H
      ];

      // 1차: 단일 따옴표
      let query = `UPDATE WHERE A = '${whereId}' VALUES ${JSON.stringify(updatedRow)}`;

      // 디버그 상세 로그
      console.log("DEBUG[update] sheet:", PAYMENT_SHEET);
      console.log("DEBUG[update] original.id:", original.id, "len:", String(original.id).length);
      console.log(
        "DEBUG[update] codepoints:",
        Array.from(String(original.id)).map((c) => c.charCodeAt(0))
      );
      console.log("DEBUG[update] normalizedId:", normalizedId, "len:", normalizedId.length);
      console.log("DEBUG[update] query(1):", query);
      console.log("DEBUG[update] payload row:", updatedRow);

      try {
        await sheetsUpdate(
          PAYMENT_SHEET.spreadsheetId,
          PAYMENT_SHEET.sheetName,
          query,
        );
      } catch (e) {
        // 2차: 이중 따옴표로 재시도
        const query2 = `UPDATE WHERE A = "${whereId}" VALUES ${JSON.stringify(updatedRow)}`;
        console.warn("DEBUG[update] 1차 실패. 이중 따옴표로 재시도. query(2):", query2);
        await sheetsUpdate(
          PAYMENT_SHEET.spreadsheetId,
          PAYMENT_SHEET.sheetName,
          query2,
        );
      }

      const data = await fetchFilteredPayments(user?.name || "");
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);
      handleEditCancel();
    } catch (err: any) {
      console.error("handleUpdate error:", err);
      alert(
        "수정 중 오류가 발생했습니다. 개발자 콘솔을 확인하세요.\n" +
        (err?.message ? `오류: ${err.message}` : ""),
      );
    } finally {
      setUpdating(false);
    }
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
        {/* 신청 폼 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl">
          <form onSubmit={handleSubmit} className="flex justify-center">
            <div className="w-[50rem] flex flex-col gap-[0.5rem]">
              {/* 결재 유형 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="type">
                  결재 유형
                </label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="grow-1"
                >
                  <option value="정기">정기</option>
                  <option value="비정기">비정기</option>
                  <option value="추가요청">추가요청</option>
                  <option value="사후알림">사후알림</option>
                  <option value="야근신청">야근신청</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              {/* 불참일 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="absentDate">
                  불참일
                </label>
                <input
                  type="date"
                  id="absentDate"
                  name="absentDate"
                  value={form.absentDate}
                  onChange={handleChange}
                  className=""
                  required
                />
              </div>

              {/* 불참 일정 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="schedule">
                  불참 일정
                </label>
                <input
                  type="text"
                  id="schedule"
                  name="schedule"
                  value={form.schedule}
                  onChange={handleChange}
                  placeholder="예) 청붓 일정 불참"
                  className="border border-gray-300 rounded px-3 py-2"
                />
              </div>

              {/* 사유 */}
              <div className="flex flex-col gap-[0.25rem]">
                <label className="text-sm" htmlFor="reason">
                  사유
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  placeholder="예) 불교대 반담당회의 (20:00-21:30)"
                  rows={4}
                />
              </div>

              <LoadingButton
                type="submit"
                className="purple"
                loading={submitting}
              >
                결재 신청
              </LoadingButton>
            </div>
          </form>
        </div>

        {/* 신청 목록 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl flex justify-center">
          {requests.length === 0 ? (
            <div className="text-dark-gray">신청 현황이 없습니다.</div>
          ) : (
            <div className="table-wrapper w-[50rem]">
              <table className="max-w-full">
                <thead>
                  <tr>
                    <th className="">구분</th>
                    <th className="">신청 날짜</th>
                    <th className="">불참일</th>
                    <th className="">불참 일정</th>
                    <th className="">사유</th>
                    <th className="">결재 상태</th>
                    <th className="">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r) => {
                    const isEditing = editingId === r.id;
                    return (
                      <tr key={r.id} className="">
                        <td className="">
                          {isEditing ? (
                            <select
                              name="type"
                              value={editForm.type ?? r.type}
                              onChange={handleEditChange}
                              className="text-sm"
                            >
                              <option value="정기">정기</option>
                              <option value="비정기">비정기</option>
                              <option value="추가요청">추가요청</option>
                              <option value="사후알림">사후알림</option>
                              <option value="야근신청">야근신청</option>
                              <option value="기타">기타</option>
                            </select>
                          ) : (
                            r.type
                          )}
                        </td>

                        <td className="">{toYMD(r.requestDate)}</td>
                        <td className="">
                          {isEditing ? (
                            <input
                              type="date"
                              name="absentDate"
                              value={editForm.absentDate ?? r.absentDate}
                              onChange={handleEditChange}
                              className="text-sm"
                            />
                          ) : (
                            r.absentDate
                          )}
                        </td>

                        <td className="">
                          {isEditing ? (
                            <input
                              type="text"
                              name="schedule"
                              value={editForm.schedule ?? r.schedule}
                              onChange={handleEditChange}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            />
                          ) : (
                            r.schedule || "-"
                          )}
                        </td>

                        <td className="">
                          {isEditing ? (
                            <input
                              type="text"
                              name="reason"
                              value={editForm.reason ?? r.reason}
                              onChange={handleEditChange}
                              className="text-sm border border-gray-300 rounded px-2 py-1 w-full"
                            />
                          ) : (
                            r.reason || "-"
                          )}
                        </td>

                        <td className="">{r.approved || "대기"}</td>

                        <td className="flex justify-center gap-[0.25rem]">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleUpdate(r)}
                                className="text-sm purple"
                                disabled={updating}
                              >
                                {updating ? "저장 중..." : "저장"}
                              </button>
                              <button
                                onClick={handleEditCancel}
                                className="text-sm gray"
                                disabled={updating}
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEditStart(r)}
                                className="text-sm purple"
                                disabled={deletingId === r.id}
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="text-sm red"
                                disabled={deletingId === r.id}
                              >
                                {deletingId === r.id ? "삭제 중..." : "삭제"}
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}