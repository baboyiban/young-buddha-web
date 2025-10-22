await import("../../../test/setup");
import {
  describe,
  it,
  expect,
  beforeEach,
  mock,
} from "bun:test";

// API 함수들 모킹 (must happen before importing paymentService)
mock.module("@/lib/api/payment", () => ({
  fetchFilteredPayments: (globalThis as any).jest.fn(),
  updatePaymentStatus: (globalThis as any).jest.fn(),
}));

const { fetchFilteredPayments, updatePaymentStatus } = await import("@/lib/api/payment");
const { paymentService } = await import("../paymentService");

const mockFetchFilteredPayments = fetchFilteredPayments as unknown as any;
const mockUpdatePaymentStatus = updatePaymentStatus as unknown as any;

describe("paymentService", () => {
  beforeEach(() => {
    mockFetchFilteredPayments.mockClear();
    mockUpdatePaymentStatus.mockClear();
  });

  describe("getAdminPayments", () => {
    it("관리자 결제 목록을 올바르게 조회한다", async () => {
      const mockData = [
        {
          id: "REQ-1",
          email: "user@example.com",
          userId: "user123",
          name: "사용자",
          requestDate: "2024-01-15",
          absentDate: "2024-01-16",
          type: "정기" as const, // "연차" → "정기"로 변경
          schedule: "오전",
          reason: "개인사유",
          approved: "승인" as const,
        },
      ];

      mockFetchFilteredPayments.mockResolvedValueOnce({
        data: mockData,
        totalCount: 1,
      });

      const result = await paymentService.getAdminPayments({
        page: 1,
        pageSize: 10,
        statusFilter: "전체",
        sortOrder: "desc",
      });

      expect((mockFetchFilteredPayments as any).mock.calls[0]).toEqual([
        "",
        true,
        1,
        10,
        "전체",
        undefined,
        "desc",
      ]);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].requestDate).toBe("2024-01-15");
      expect(result.data[0].absentDate).toBe("2024-01-16");
      expect(result.totalCount).toBe(1);
    });

    it("필터가 적용된 상태로 조회한다", async () => {
      mockFetchFilteredPayments.mockResolvedValueOnce({
        data: [],
        totalCount: 0,
      });

      await paymentService.getAdminPayments({
        page: 2,
        pageSize: 20,
        statusFilter: "승인",
        sortOrder: "asc",
      });

      expect((mockFetchFilteredPayments as any).mock.calls[0]).toEqual([
        "",
        true,
        2,
        20,
        "승인",
        undefined,
        "asc",
      ]);
    });
  });

  describe("getUserPayments", () => {
    it("사용자 결제 목록을 올바르게 조회한다", async () => {
      const mockData = [
        {
          id: "REQ-2",
          email: "user@example.com",
          userId: "user123", // 추가
          name: "사용자", // 추가
          requestDate: "2024-01-20", // Date → string
          absentDate: "2024-01-21", // Date → string
          type: "비정기" as const, // 유효한 PaymentType
          schedule: "오후",
          reason: "병원",
          approved: "대기" as const, // 유효한 PaymentStatus
        },
      ];

      mockFetchFilteredPayments.mockResolvedValueOnce({
        data: mockData,
        totalCount: 1,
      });

      const result = await paymentService.getUserPayments({
        email: "user@example.com",
        page: 1,
        pageSize: 10,
        typeFilter: "전체",
        sortOrder: "desc",
      });

      expect((mockFetchFilteredPayments as any).mock.calls[0]).toEqual([
        "user@example.com",
        true,
        1,
        10,
        "전체",
        undefined,
        "desc",
      ]);

      expect(result.data[0].type).toBe("비정기");
    });

    it("타입 필터가 적용된다", async () => {
      mockFetchFilteredPayments.mockResolvedValueOnce({
        data: [],
        totalCount: 0,
      });

      await paymentService.getUserPayments({
        email: "user@example.com",
        page: 1,
        pageSize: 10,
        typeFilter: "연차",
        sortOrder: "desc",
      });

      expect((mockFetchFilteredPayments as any).mock.calls[0]).toEqual([
        "user@example.com",
        true,
        1,
        10,
        "전체",
        "연차",
        "desc",
      ]);
    });
  });

  describe("updateStatus", () => {
    it("결제 상태를 업데이트한다", async () => {
      mockUpdatePaymentStatus.mockResolvedValueOnce(true);

      const result = await paymentService.updateStatus("REQ-123", "승인");

      expect((mockUpdatePaymentStatus as any).mock.calls[0]).toEqual(["REQ-123", "승인"]);
      expect(result).toBe(true); // updatePaymentStatus returns boolean (mocked as true)
    });
  });

  describe("batchUpdateStatus", () => {
    it("여러 결제 상태를 일괄 업데이트한다", async () => {
      mockUpdatePaymentStatus.mockResolvedValue(true);

      const updates = [
        { id: "REQ-1", status: "승인" },
        { id: "REQ-2", status: "거부" },
      ];

      const results = await paymentService.batchUpdateStatus(updates);

      expect((mockUpdatePaymentStatus as any).mock.calls.length).toBe(2);
      expect((mockUpdatePaymentStatus as any).mock.calls[0]).toEqual(["REQ-1","승인"]);
      expect((mockUpdatePaymentStatus as any).mock.calls[1]).toEqual(["REQ-2","거부"]);
      expect(results).toHaveLength(2);
      expect(results).toEqual([true, true]);
    });
  });
});
