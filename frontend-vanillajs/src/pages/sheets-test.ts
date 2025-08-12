import { sheetsService } from "../lib/sheets/service";

// 로딩 표시 함수
function showLoading(element: HTMLElement) {
  element.style.display = 'block';
}

// 로딩 숨기기 함수
function hideLoading(element: HTMLElement) {
  element.style.display = 'none';
}

export async function setupSheetsTestPage(): Promise<void> {
  console.log('[sheets-test] setup start');

  const form = document.getElementById('sheets-test-form') as HTMLFormElement | null;
  const loadingDiv = document.getElementById('loading') as HTMLElement | null;
  const resultDiv = document.getElementById('result') as HTMLElement | null;
  const resultData = document.getElementById('result-data') as HTMLElement | null;
  const errorDiv = document.getElementById('error') as HTMLElement | null;
  const errorMessage = document.getElementById('error-message') as HTMLElement | null;

  if (!form || !loadingDiv || !resultDiv || !resultData || !errorDiv || !errorMessage) {
    console.warn('[sheets-test] required elements not found');
    return;
  }

  console.log('[sheets-test] elements ready');

  const showLoading = (el: HTMLElement) => (el.style.display = 'block');
  const hideLoading = (el: HTMLElement) => (el.style.display = 'none');

  const showResult = (data: any) => {
    resultData.textContent = JSON.stringify(data, null, 2);
    resultDiv.style.display = 'block';
  };

  const hideResult = () => {
    resultDiv.style.display = 'none';
    resultData.textContent = '';
  };

  const showError = (message: string) => {
    errorMessage.textContent = message;
    errorDiv.style.display = 'block';
  };

  const hideError = () => {
    errorDiv.style.display = 'none';
    errorMessage.textContent = '';
  };

  const fetchBtn = document.getElementById('fetch-btn');
  if (fetchBtn) {
    fetchBtn.addEventListener('click', () => {
      const ev = new Event('submit', { cancelable: true });
      form.dispatchEvent(ev);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const spreadsheetId = (formData.get('spreadsheetId') as string) || '';
    const gid = (formData.get('gid') as string) || '';
    const range = (formData.get('range') as string) || '';
    const query = (formData.get('query') as string) || '';

    if (!spreadsheetId || !query) {
      showError('스프레드시트 ID와 쿼리는 필수 입력값입니다.');
      return;
    }

    showLoading(loadingDiv);
    hideResult();
    hideError();

    try {
      const options: any = { spreadsheetId, query };
      if (gid.trim()) options.gid = gid.trim();
      if (range.trim()) options.range = range.trim();

      const result = await sheetsService.querySpreadsheetWithOptions(options);
      showResult(result);
    } catch (error: any) {
      console.error('[sheets-test] API 호출 실패:', error);
      showError(error?.message || '데이터 조회 중 오류가 발생했습니다.');
    } finally {
      hideLoading(loadingDiv);
    }
  });

  console.log('[sheets-test] setup done');
}

/* 위로 모두 통합되어 별도 전역 초기화는 제거 */
