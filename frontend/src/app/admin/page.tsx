"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import { fetchFilteredPayments, isAdmin } from "@/lib/api/payment";
import { sheetsUpdate, escapeSheetQueryString } from "@/lib/api/sheets/client";
import { PAYMENT_SHEET } from "@/lib/constants/sheets";
import { PaymentRequest } from "@/lib/types/payment";
import { normalizeId, toYMD } from "@/lib/utils/dateUtils";

export default function AdminPage() {
  // 상태 관리
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdmin = async () => {
      if (!authLoading && user?.email) {
        const admin = await isAdmin(user.email);
        setIsAdminUser(admin);

        // 관리자가 아니면 로딩 종료
        if (!admin) {
          setLoading(false);
          return;
        }

        // 관리자면 모든 결재 신청 목록 로딩
        try {
          // 모든 결재 신청을 조회하기 위해 빈 문자열로 호출
          const data = await fetchFilteredPayments("");
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
      }
    };

    checkAdmin();
  }, [user, authLoading]);

  // 결재 상태 변경 핸들러
  const handleApprove = async (request: PaymentRequest, status: string) => {
    try {
      setUpdatingId(request.id);

      const normalizedId = normalizeId(request.id);
      const whereId = escapeSheetQueryString(normalizedId);

      // 업데이트할 행 데이터 (결재 상태만 변경)
      const updatedRow = [
        normalizedId, // A: id는 정규화된 값으로 고정
        request.email, // B: 이메일
        request.userId, // C: 아이디
        request.name, // D: 이름
        request.type, // E: 구분
        toYMD(request.requestDate), // F: 신청날짜
        toYMD(request.absentDate), // G: 불참일
        request.schedule, // H: 불참일정
        request.reason, // I: 사유
        status, // J: 결재상태 (변경된 값)
      ];

      // 단일 따옴표로 업데이트
      let query = `UPDATE WHERE A = '${whereId}' VALUES ${JSON.stringify(updatedRow)}`;

      await sheetsUpdate(
        PAYMENT_SHEET.spreadsheetId,
        PAYMENT_SHEET.sheetName,
        query,
      );

      // 목록 갱신
      const data = await fetchFilteredPayments("");
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);
    } catch (err) {
      console.error("handleApprove error:", err);
      alert("결재 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // 관리자가 아닌 경우
  if (!isAdminUser) {
    return (
      <div className="min-h-[calc(100svh-52px-0.5rem)] flex items-center justify-center">
        <div className="text-dark-gray">관리자만 접근할 수 있습니다.</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100svh-52px-0.5rem)]">
      <div className="flex flex-col gap-[0.5rem]">
        {/* 페이지 제목 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl">
          <h1 className="text-2xl font-bold">결재 관리</h1>
          <p className="text-dark-gray">
            모든 사용자의 결재 신청을 관리할 수 있습니다.
          </p>
        </div>

        {/* 결재 신청 목록 */}
        <div className="mx-[0.5rem] p-[1rem] bg-white rounded-xl flex justify-center">
          {requests.length === 0 ? (
            <div className="text-dark-gray">결재 신청이 없습니다.</div>
          ) : (
            <div className="table-wrapper">
              <table className="max-w-full">
                <thead>
                  <tr>
                    <th className="">이메일</th>
                    <th className="">아이디</th>
                    <th className="">이름</th>
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
                  {requests.map((r) => (
                    <tr key={r.id} className="">
                      <td className="">{r.email}</td>
                      <td className="">{r.userId}</td>
                      <td className="">{r.name}</td>
                      <td className="">{r.type}</td>
                      <td className="">{toYMD(r.requestDate)}</td>
                      <td className="">{toYMD(r.absentDate)}</td>
                      <td className="">{r.schedule || "-"}</td>
                      <td className="">{r.reason || "-"}</td>
                      <td className="">{r.approved || "대기"}</td>
                      <td className="flex justify-center gap-[0.25rem]">
                        {r.approved === "승인" ? (
                          <button
                            onClick={() => handleApprove(r, "대기")}
                            className="text-sm gray"
                            disabled={updatingId === r.id}
                          >
                            {updatingId === r.id ? "처리 중..." : "승인 취소"}
                          </button>
                        ) : r.approved === "반려" ? (
                          <button
                            onClick={() => handleApprove(r, "대기")}
                            className="text-sm gray"
                            disabled={updatingId === r.id}
                          >
                            {updatingId === r.id ? "처리 중..." : "반려 취소"}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleApprove(r, "승인")}
                              className="text-sm purple"
                              disabled={updatingId === r.id}
                            >
                              {updatingId === r.id ? "처리 중..." : "승인"}
                            </button>
                            <button
                              onClick={() => handleApprove(r, "반려")}
                              className="text-sm red"
                              disabled={updatingId === r.id}
                            >
                              {updatingId === r.id ? "처리 중..." : "반려"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
