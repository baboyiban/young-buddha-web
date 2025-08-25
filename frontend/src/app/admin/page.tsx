"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import LoadingSpinner from "@/components/LoadingSpinner";
import Pagination from "@/components/Pagination";
import { fetchFilteredPayments } from "@/lib/api/payment";
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

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // 관리자 권한: 미들웨어에서 이미 차단되지만, 클라이언트에서도 user.roles 참고
  useEffect(() => {
    const proceed = async () => {
      if (!authLoading && user?.email) {
        const isAdminRole =
          Array.isArray(user.roles) && user.roles.includes("ADMIN");
        setIsAdminUser(!!isAdminRole);

        if (!isAdminRole) {
          setLoading(false);
          return;
        }

        try {
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

    proceed();
  }, [user, authLoading]);

  // 현재 페이지에 표시할 데이터 계산
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageRequests = requests.slice(startIndex, endIndex);

  // 총 페이지 수 계산
  const totalPages = Math.ceil(requests.length / itemsPerPage) || 1;

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

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

      // 현재 페이지에 아이템이 없으면 이전 페이지로 이동
      const newTotalPages = Math.ceil(normalized.length / itemsPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
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
        <div className="text-gray-50">관리자만 접근할 수 있습니다.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[0.5rem]">
      {/* 결재 신청 목록 */}
      <div className="mt-[0] m-[0.5rem] p-[1rem] bg-white rounded-xl flex flex-col space-y-[0.5rem] items-center">
        {requests.length === 0 ? (
          <div className="text-gray-50">결재 신청이 없습니다.</div>
        ) : (
          <>
            <div className="table-wrapper w-[60rem] max-w-full">
              <table className="w-full small">
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
                  {currentPageRequests.map((r) => (
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

            {/* 페이지네이션 컴포넌트 */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              totalItems={requests.length}
            />
          </>
        )}
      </div>
    </div>
  );
}
