"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 10;

  // 필터링 상태
  const [statusFilter, setStatusFilter] = useState<string>("전체");

  // 정렬 상태
  const [sortOrder, setSortOrder] = useState<string>("desc"); // desc: 최신순, asc: 오래된순

  // 다중 선택 상태
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);
  const [isAllSelected, setIsAllSelected] = useState(false);

  // 데이터 로드 함수
  const loadPayments = useCallback(async () => {
    if (!authLoading && user?.email) {
      const isAdminRole =
        Array.isArray(user.roles) && user.roles.includes("ADMIN");
      setIsAdminUser(!!isAdminRole);

      if (!isAdminRole) {
        setLoading(false);
        return;
      }

      try {
        const { data, totalCount } = await fetchFilteredPayments(
          "",
          true,
          currentPage,
          itemsPerPage,
          statusFilter,
          sortOrder,
        );
        const normalized = data.map((r: PaymentRequest) => ({
          ...r,
          requestDate: toYMD(r.requestDate),
          absentDate: toYMD(r.absentDate),
        }));
        setRequests(normalized);
        setTotalItems(totalCount);
      } catch (err) {
        console.error("결재 데이터 로드 실패:", err);
        setRequests([]);
        setTotalItems(0);
        // 401 에러인 경우 로그인 페이지로 리다이렉트
        if (err instanceof Error && err.message.includes("401")) {
          alert("인증이 만료되었습니다. 다시 로그인해주세요.");
          window.location.href = "/login";
        }
      } finally {
        setLoading(false);
      }
    }
  }, [authLoading, user, currentPage, statusFilter, sortOrder]);

  // 관리자 권한: 미들웨어에서 이미 차단되지만, 클라이언트에서도 user.roles 참고
  useEffect(() => {
    const proceed = async () => {
      await loadPayments();
    };

    proceed();
  }, [user, authLoading, loadPayments]);

  // 총 페이지 수 계산
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  // 현재 페이지에 표시할 데이터
  const currentPageRequests = requests;

  // 페이지 변경 핸들러
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedRequests([]);
    setIsAllSelected(false);
    // 페이지 변경 시 데이터 다시 로드
    setLoading(true);
  };

  // 필터 변경 핸들러
  const handleFilterChange = (filter: string) => {
    setStatusFilter(filter);
    setCurrentPage(1); // 필터 변경 시 첫 페이지로 이동
    setSelectedRequests([]);
    setIsAllSelected(false);
    setLoading(true); // 데이터 다시 로드
  };

  // 개별 선택 토글
  const toggleSelection = (id: string) => {
    setSelectedRequests((prev) =>
      prev.includes(id)
        ? prev.filter((selectedId) => selectedId !== id)
        : [...prev, id],
    );
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedRequests([]);
    } else {
      setSelectedRequests(currentPageRequests.map((r) => r.id));
    }
    setIsAllSelected(!isAllSelected);
  };

  // 배치 승인 처리
  const handleBatchApprove = async (status: string) => {
    if (selectedRequests.length === 0) return;

    try {
      setUpdatingId("batch"); // 배치 처리 중임을 표시

      // 선택된 모든 요청 처리
      for (const id of selectedRequests) {
        const request = requests.find((r) => r.id === id);
        if (request) {
          const normalizedId = normalizeId(request.id);
          const whereId = escapeSheetQueryString(normalizedId);

          const updatedRow = [
            normalizedId,
            request.email,
            request.userId,
            request.name,
            request.type,
            toYMD(request.requestDate),
            toYMD(request.absentDate),
            request.schedule,
            request.reason,
            status,
          ];

          const query = `UPDATE WHERE A = '${whereId}' VALUES ${JSON.stringify(updatedRow)}`;
          await sheetsUpdate(
            PAYMENT_SHEET.spreadsheetId,
            PAYMENT_SHEET.sheetName,
            query,
          );
        }
      }

      // 목록 갱신
      const { data, totalCount } = await fetchFilteredPayments(
        "",
        true,
        currentPage,
        itemsPerPage,
        statusFilter,
        sortOrder,
      );
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);
      setTotalItems(totalCount);

      // 선택 초기화
      setSelectedRequests([]);
      setIsAllSelected(false);

      alert(`${selectedRequests.length}개 항목이 ${status} 처리되었습니다.`);
    } catch (err) {
      console.error("batch approve error:", err);
      alert("배치 처리 중 오류가 발생했습니다.");
      // 401 에러인 경우 로그인 페이지로 리다이렉트
      if (err instanceof Error && err.message.includes("401")) {
        alert("인증이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "/login";
      }
    } finally {
      setUpdatingId(null);
    }
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
      const { data, totalCount } = await fetchFilteredPayments(
        "",
        true,
        currentPage,
        itemsPerPage,
        statusFilter,
      );
      const normalized = data.map((r: PaymentRequest) => ({
        ...r,
        requestDate: toYMD(r.requestDate),
        absentDate: toYMD(r.absentDate),
      }));
      setRequests(normalized);
      setTotalItems(totalCount);

      // 현재 페이지에 아이템이 없으면 이전 페이지로 이동
      const newTotalPages = Math.ceil(totalCount / itemsPerPage);
      if (currentPage > newTotalPages && newTotalPages > 0) {
        setCurrentPage(newTotalPages);
      }
    } catch (err) {
      console.error("handleApprove error:", err);
      alert("결재 상태 변경 중 오류가 발생했습니다.");
      // 401 에러인 경우 로그인 페이지로 리다이렉트
      if (err instanceof Error && err.message.includes("401")) {
        alert("인증이 만료되었습니다. 다시 로그인해주세요.");
        window.location.href = "/login";
      }
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
      <div className="mt-[0] m-[0.5rem] p-[1rem] bg-white rounded-xl flex flex-col space-y-[0.5rem]">
        {/* 필터 선택 UI */}
        <div className="grid grid-flow-col auto-cols-min gap-[0.25rem] mb-[0.5rem] overflow-x-auto rounded-[1rem]">
          <div className="flex gap-[0.5rem] mb-[1rem] self-start">
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="px-[0.5rem] py-[0.25rem] border rounded text-sm"
            >
              <option value="전체">전체 상태</option>
              <option value="대기">대기 중</option>
              <option value="승인">승인됨</option>
              <option value="반려">반려됨</option>
            </select>

            {/* 정렬 선택 UI */}
            <select
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value);
                setLoading(true);
              }}
              className="px-[0.5rem] py-[0.25rem] border rounded text-sm"
            >
              <option value="desc">최신순</option>
              <option value="asc">오래된순</option>
            </select>

            {/* 새로고침 버튼 */}
            <button onClick={loadPayments} className="gray" disabled={loading}>
              {loading ? "새로고침 중..." : "새로고침"}
            </button>
          </div>

          {/* 배치 처리 버튼들 */}
          {selectedRequests.length > 0 && (
            <div className="flex gap-[0.25rem]">
              <button
                onClick={() => handleBatchApprove("승인")}
                className="text-sm purple"
                disabled={updatingId === "batch"}
              >
                {updatingId === "batch"
                  ? "처리 중..."
                  : `선택 ${selectedRequests.length}개 승인`}
              </button>
              <button
                onClick={() => handleBatchApprove("반려")}
                className="text-sm red"
                disabled={updatingId === "batch"}
              >
                {updatingId === "batch"
                  ? "처리 중..."
                  : `선택 ${selectedRequests.length}개 반려`}
              </button>
            </div>
          )}
        </div>

        {requests.length === 0 ? (
          <div className="text-gray-50">
            {statusFilter === "전체"
              ? "결재 신청이 없습니다."
              : `'${statusFilter}' 상태의 결재 신청이 없습니다.`}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="table-wrapper w-fit max-w-full mb-[0.5rem]">
              <table className="w-full small">
                <thead>
                  <tr>
                    <th className="">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="w-[0.75rem] h-[0.75rem]"
                      />
                    </th>
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
                    <tr
                      key={r.id}
                      className={
                        selectedRequests.includes(r.id) ? "bg-blue-50" : ""
                      }
                    >
                      <td className="">
                        <input
                          type="checkbox"
                          checked={selectedRequests.includes(r.id)}
                          onChange={() => toggleSelection(r.id)}
                          className="w-[0.75rem] h-[0.75rem]"
                        />
                      </td>
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
              totalItems={totalItems}
            />
          </div>
        )}
      </div>
    </div>
  );
}
