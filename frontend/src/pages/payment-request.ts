import { apiClient } from "../lib/api";
import { API_ENDPOINTS } from "../lib/api/endpoints";
import { AsyncHandler } from "../lib/utils/async-handler";
import { DOMUtils } from "../lib/utils/dom";

const PAYMENT_CONFIG = {
  apiEndpoint: API_ENDPOINTS.PAYMENT.BASE,
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
    (data) => apiClient.post(PAYMENT_CONFIG.apiEndpoint, data),
    {
      successMessage: UI_MESSAGES.submitSuccess,
      onError: (error) => {
        console.error("결재 요청 등록 실패:", error);
      },
    }
  );
}
