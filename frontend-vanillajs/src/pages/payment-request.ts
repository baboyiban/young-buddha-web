import { apiClient } from "../lib/api";
import { API_ENDPOINTS } from "../lib/api/endpoints";
import { AsyncHandler } from "../lib/utils/async-handler";
import { DOMUtils } from "../lib/utils/dom";
import { SHEETS_CONFIG } from "../lib/config/sheets";

const PAYMENT_CONFIG = {
  elementIds: {
    paymentForm: "payment-form",
  },
} as const;

const UI_MESSAGES = {
  submitSuccess: "신청 완료!",
  submitError: "신청 실패",
} as const;

export function setupPaymentRequestPage(): void {
  setupPaymentForm();
}

function setupPaymentForm(): void {
  const form = DOMUtils.getElementById<HTMLFormElement>(
    PAYMENT_CONFIG.elementIds.paymentForm
  );
  if (!form) return;

  const cleanForm = cloneFormWithoutListeners(form);
  cleanForm.addEventListener("submit", handleFormSubmit);
}

function cloneFormWithoutListeners(form: HTMLFormElement): HTMLFormElement {
  const newForm = form.cloneNode(true) as HTMLFormElement;
  form.parentNode?.replaceChild(newForm, form);
  return newForm;
}

async function handleFormSubmit(event: Event): Promise<void> {
  event.preventDefault();
  const form = event.target as HTMLFormElement;

  await AsyncHandler.handleFormSubmit(
    form,
    (data) => submitToGoogleSheets(data),
    {
      successMessage: UI_MESSAGES.submitSuccess,
      onError: (error) => {
        console.error("결재 요청 등록 실패:", error);
      },
    }
  );
}

/**
 * 폼 데이터를 Google Sheets에 저장
 */
async function submitToGoogleSheets(
  formData: Record<string, string>
): Promise<any> {
  try {
    // 현재 시간을 ID로 사용 (더 정교한 ID 생성 방법 사용 가능)
    const id = Date.now();
    const requestDate = new Date().toISOString().split("T")[0];

    // 폼 데이터를 Google Sheets 행 형태로 변환
    // 컬럼 순서: A=ID, B=이름, C=신청일, D=유형, E=불참일, F=시간대, G=사유, H=상태
    const rowData = [
      id.toString(),
      formData.name || "",
      requestDate,
      formData.type || "",
      formData.absent_date || "",
      formData.time_slot || "",
      formData.reason || "",
      "대기", // 초기 상태
      "", // 승인자 (빈값)
      "", // 승인일 (빈값)
      "", // 코멘트 (빈값)
    ];

    // Google Sheets Write API 호출
    const writeData = {
      values: [rowData],
    };

    const queryParams = new URLSearchParams({
      spreadsheet_id: SHEETS_CONFIG.PAYMENT.SPREADSHEET_ID,
      range: SHEETS_CONFIG.PAYMENT.RANGE,
    });

    const endpoint = `${API_ENDPOINTS.SHEETS.WRITE}?${queryParams.toString()}`;
    return await apiClient.post(endpoint, writeData);
  } catch (error) {
    console.error("Google Sheets 저장 실패:", error);
    throw error;
  }
}
