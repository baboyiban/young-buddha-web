import { apiClient } from "../lib/api";
import { API_ENDPOINTS } from "../lib/api/endpoints";
import { PageStateManager } from "../lib/utils/page-state";
import { AsyncHandler } from "../lib/utils/async-handler";
import type { AbsenceRequest } from "../types/payment";

const PAYMENT_CONFIG = {
  apiEndpoint: API_ENDPOINTS.PAYMENT.BASE,
  maxRecords: 10,
  elementIds: {
    paymentList: "payment-list",
  },
} as const;

const UI_MESSAGES = {
  loading: "불러오는 중...",
  noPayments: "결재 요청이 없습니다.",
  loadError: "불러오기 실패",
} as const;

const TABLE_HEADERS = [
  "이름",
  "유형",
  "신청일",
  "불참일",
  "시간대",
  "사유",
  "상태",
] as const;

const pageState = new PageStateManager(PAYMENT_CONFIG.elementIds.paymentList);

export function setupPaymentApprovalPage(): void {
  loadPayments();
}

async function loadPayments(): Promise<void> {
  await AsyncHandler.handleWithPageState(pageState, fetchPayments, {
    loadingMessage: UI_MESSAGES.loading,
    emptyCheck: (payments) => payments.length === 0,
    emptyMessage: UI_MESSAGES.noPayments,
    onSuccess: (payments) => {
      const html = createPaymentTable(payments);
      pageState.showContent(html);
    },
    onError: (error) => {
      console.error("결재 요청 목록 로드 실패:", error);
    },
  });
}

async function fetchPayments(): Promise<AbsenceRequest[]> {
  const endpoint = `${PAYMENT_CONFIG.apiEndpoint}?last_n=${PAYMENT_CONFIG.maxRecords}`;
  return await apiClient.get(endpoint);
}

function createPaymentTable(payments: AbsenceRequest[]): string {
  const headerRow = TABLE_HEADERS.map((header) => `<th>${header}</th>`).join("");
  const bodyRows = payments.map(createPaymentRow).join("");

  return `
    <table>
      <thead>
        <tr>${headerRow}</tr>
      </thead>
      <tbody>
        ${bodyRows}
      </tbody>
    </table>
  `;
}

function createPaymentRow(payment: AbsenceRequest): string {
  return `
    <tr>
      <td>${payment.name}</td>
      <td>${payment.type}</td>
      <td>${payment.request_date}</td>
      <td>${payment.absent_date}</td>
      <td>${payment.time_slot ?? ""}</td>
      <td>${payment.reason ?? ""}</td>
      <td>${payment.status}</td>
    </tr>
  `;
}
