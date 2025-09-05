import { fetchFilteredPayments, updatePaymentStatus } from '@/lib/api/payment';
import { PaymentRequest } from '@/lib/types/payment';
import { toYMD } from '@/lib/utils/dateUtils';

const ITEMS_PER_PAGE = 10;

export const paymentService = {
  async getAdminPayments(filters: {
    currentPage: number;
    statusFilter: string;
    sortOrder: string;
  }) {
    const { currentPage, statusFilter, sortOrder } = filters;
    const { data, totalCount } = await fetchFilteredPayments(
      '',
      true,
      currentPage,
      ITEMS_PER_PAGE,
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
