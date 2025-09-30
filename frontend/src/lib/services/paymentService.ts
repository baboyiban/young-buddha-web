import { fetchFilteredPayments, updatePaymentStatus } from '@/lib/api/payment';
import { PaymentRequest } from '@/lib/types/payment';
import { toYMD } from '@/lib/utils/dateUtils';

const ITEMS_PER_PAGE = 10;

export const paymentService = {
  async getAdminPayments(filters: {
    page: number;
    pageSize: number;
    statusFilter: string;
    sortOrder: string;
  }) {
    const { page, pageSize, statusFilter, sortOrder } = filters;
    // 페이지네이션 적용: 전달받은 page와 pageSize 사용
    const { data, totalCount } = await fetchFilteredPayments(
      '',
      true,
      page,
      pageSize,
      statusFilter,
      undefined,
      sortOrder
    );

    const normalized = data.map((r: PaymentRequest) => ({
      ...r,
      requestDate: toYMD(r.requestDate),
      absentDate: toYMD(r.absentDate),
    }));

    return { data: normalized, totalCount };
  },

  async getUserPayments(filters: {
    email: string;
    page: number;
    pageSize: number;
    typeFilter: string;
    sortOrder: string;
  }) {
    const { email, page, pageSize, typeFilter, sortOrder } = filters;
    // 페이지네이션 적용
    const { data, totalCount } = await fetchFilteredPayments(
      email,
      true,
      page,
      pageSize,
      "전체",
      typeFilter === "전체" ? undefined : typeFilter,
      sortOrder
    );

    const normalized = data.map((r: PaymentRequest) => ({
      ...r,
      requestDate: toYMD(r.requestDate),
      absentDate: toYMD(r.absentDate),
    }));

    return { data: normalized, totalCount };
  },

  async updateStatus(paymentId: string, status: string) {
    return await updatePaymentStatus(paymentId, status);
  },

  async batchUpdateStatus(updates: { id: string; status: string }[]) {
    // This assumes an API endpoint for batch updates exists or will be created.
    // For now, we simulate it by calling single updates in a loop.
    const results = [];
    for (const update of updates) {
      results.push(await updatePaymentStatus(update.id, update.status));
    }
    return results;
  },
};
