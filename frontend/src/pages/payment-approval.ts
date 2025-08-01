import { apiClient } from "../lib/api";
import { API_ENDPOINTS } from "../lib/api/endpoints";
import { PageStateManager } from "../lib/utils/page-state";
import { AsyncHandler } from "../lib/utils/async-handler";
import { SHEETS_CONFIG, SheetsQueryHelper } from "../lib/config/sheets";
import type { AbsenceRequest } from "../types/payment";

const PAYMENT_CONFIG = {
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
  "액션",
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
      setupActionButtons();
    },
    onError: (error) => {
      console.error("결재 요청 목록 로드 실패:", error);
    },
  });
}

async function fetchPayments(): Promise<AbsenceRequest[]> {
  try {
    // Google Sheets Query API를 사용하여 대기 중인 결제 요청 데이터 조회
    const query = SheetsQueryHelper.getPendingPayments(
      PAYMENT_CONFIG.maxRecords
    );
    const queryParams = new URLSearchParams({
      spreadsheet_id: SHEETS_CONFIG.PAYMENT.SPREADSHEET_ID,
      tq: query,
    });

    const endpoint = `${API_ENDPOINTS.SHEETS.QUERY}?${queryParams.toString()}`;
    console.log("Frontend: Requesting endpoint:", endpoint);

    const response = await apiClient.get(endpoint);
    console.log("Frontend: Raw response from server:", response);
    console.log("Frontend: Response type:", typeof response);
    console.log("Frontend: Response length:", response?.length || "N/A");

    // Google Visualization API 응답을 파싱하여 AbsenceRequest 형태로 변환
    return parseGoogleSheetsResponse(response);
  } catch (error) {
    console.error("결제 요청 데이터 조회 실패:", error);

    // 401 오류인 경우 로그인 페이지로 리다이렉트
    if (
      error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 401
    ) {
      console.log("Authentication failed, redirecting to login...");
      window.location.href = "/api/auth/google";
      return [];
    }

    throw error;
  }
}

function createPaymentTable(payments: AbsenceRequest[]): string {
  const headerRow = TABLE_HEADERS.map((header) => `<th>${header}</th>`).join(
    ""
  );
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
  const actionButtons =
    payment.status === "대기"
      ? `
    <button class="approve-btn" data-id="${payment.id}" data-name="${payment.name}">승인</button>
    <button class="reject-btn" data-id="${payment.id}" data-name="${payment.name}">거부</button>
  `
      : `<span>${payment.status}</span>`;

  return `
    <tr>
      <td>${payment.name}</td>
      <td>${payment.type}</td>
      <td>${payment.request_date}</td>
      <td>${payment.absent_date}</td>
      <td>${payment.time_slot ?? ""}</td>
      <td>${payment.reason ?? ""}</td>
      <td>${payment.status}</td>
      <td>${actionButtons}</td>
    </tr>
  `;
}

/**
 * 승인/거부 버튼 이벤트 설정
 */
function setupActionButtons(): void {
  const approveButtons = document.querySelectorAll(".approve-btn");
  const rejectButtons = document.querySelectorAll(".reject-btn");

  approveButtons.forEach((button) => {
    button.addEventListener("click", handleApprove);
  });

  rejectButtons.forEach((button) => {
    button.addEventListener("click", handleReject);
  });
}

/**
 * 승인 처리
 */
async function handleApprove(event: Event): Promise<void> {
  const button = event.target as HTMLButtonElement;
  const id = button.dataset.id;
  const name = button.dataset.name;

  if (!id || !name) return;

  try {
    button.disabled = true;
    button.textContent = "처리중...";

    await updatePaymentStatus(id, name, "승인");

    // 페이지 새로고침
    loadPayments();
  } catch (error) {
    console.error("승인 처리 실패:", error);
    button.disabled = false;
    button.textContent = "승인";
    alert("승인 처리에 실패했습니다.");
  }
}

/**
 * 거부 처리
 */
async function handleReject(event: Event): Promise<void> {
  const button = event.target as HTMLButtonElement;
  const id = button.dataset.id;
  const name = button.dataset.name;

  if (!id || !name) return;

  const reason = prompt("거부 사유를 입력하세요:");
  if (!reason) return;

  try {
    button.disabled = true;
    button.textContent = "처리중...";

    await updatePaymentStatus(id, name, "거부", reason);

    // 페이지 새로고침
    loadPayments();
  } catch (error) {
    console.error("거부 처리 실패:", error);
    button.disabled = false;
    button.textContent = "거부";
    alert("거부 처리에 실패했습니다.");
  }
}

/**
 * Google Sheets에서 결제 요청 상태 업데이트
 */
async function updatePaymentStatus(
  id: string,
  name: string,
  status: string,
  comment?: string
): Promise<void> {
  try {
    // 실제로는 특정 행을 업데이트하는 더 정교한 방법이 필요
    // 현재는 로그만 출력하고 실제 업데이트는 구현하지 않음
    console.log("Status update:", { id, name, status, comment });

    // TODO: 실제 Google Sheets 행 업데이트 구현
    // 현재는 로그만 출력
  } catch (error) {
    console.error("상태 업데이트 실패:", error);
    throw error;
  }
}

/**
 * Google Visualization API 응답을 파싱하여 AbsenceRequest 배열로 변환
 * Google Sheets의 컬럼 순서: A=ID, B=이름, C=신청일, D=유형, E=불참일, F=시간대, G=사유, H=상태
 */
function parseGoogleSheetsResponse(response: any): AbsenceRequest[] {
  try {
    console.log("Frontend: Parsing response, type:", typeof response);
    console.log("Frontend: Response content:", response);

    // Google Visualization API는 JavaScript 코드로 응답을 반환하므로 파싱 필요
    let jsonData: any;

    if (typeof response === "string") {
      console.log("Frontend: Response is string, checking format...");

      // "google.visualization.Query.setResponse({...})" 형태의 응답 파싱
      const jsonMatch = response.match(
        /google\.visualization\.Query\.setResponse\((.+)\);?$/
      );
      if (jsonMatch) {
        console.log("Frontend: Found setResponse format, extracting JSON...");
        console.log("Frontend: Extracted JSON string:", jsonMatch[1]);
        jsonData = JSON.parse(jsonMatch[1]);
      } else {
        console.log(
          "Frontend: No setResponse format found, trying direct JSON parse..."
        );
        // 순수 JSON 응답인 경우
        jsonData = JSON.parse(response);
      }
    } else {
      console.log("Frontend: Response is not string, using directly...");
      jsonData = response;
    }

    console.log("Frontend: Parsed JSON data:", jsonData);

    const table = jsonData.table;
    console.log("Frontend: Table object:", table);

    if (!table || !table.rows) {
      console.log("Frontend: No table or rows found in response");
      return [];
    }

    console.log("Frontend: Found", table.rows.length, "rows");
    console.log("Frontend: First row sample:", table.rows[0]);

    return table.rows.map((row: any, index: number): AbsenceRequest => {
      const cells = row.c || [];
      console.log(`Frontend: Row ${index} cells:`, cells);

      const parsedRow = {
        id: cells[0]?.v ? parseInt(cells[0].v) : index + 1,
        name: cells[1]?.v || "",
        request_date: cells[2]?.v || "",
        type: cells[3]?.v || "",
        absent_date: cells[4]?.v || "",
        time_slot: cells[5]?.v || null,
        reason: cells[6]?.v || null,
        status: cells[7]?.v || "대기",
        approver: cells[8]?.v || null,
        approved_at: cells[9]?.v || null,
        comment: cells[10]?.v || null,
      };

      console.log(`Frontend: Parsed row ${index}:`, parsedRow);
      return parsedRow;
    });
  } catch (error) {
    console.error("Google Sheets 응답 파싱 실패:", error);
    return [];
  }
}
