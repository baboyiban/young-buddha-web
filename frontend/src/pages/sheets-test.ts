import { sheetsService } from "../lib/sheets/service";

// 로딩 표시 함수
function showLoading(element: HTMLElement) {
  element.style.display = 'block';
}

// 로딩 숨기기 함수
function hideLoading(element: HTMLElement) {
  element.style.display = 'none';
}

// DOM 요소들
const form = document.getElementById('sheets-test-form') as HTMLFormElement;
const loadingDiv = document.getElementById('loading')!;
const resultDiv = document.getElementById('result')!;
const resultData = document.getElementById('result-data')!;
const errorDiv = document.getElementById('error')!;
const errorMessage = document.getElementById('error-message')!;

// 폼 제출 이벤트
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // 입력값 가져오기
    const formData = new FormData(form);
    const spreadsheetId = formData.get('spreadsheetId') as string;
    const gid = formData.get('gid') as string;
    const range = formData.get('range') as string;
    const query = formData.get('query') as string;

    // 입력값 검증
    if (!spreadsheetId || !query) {
      showError('스프레드시트 ID와 쿼리는 필수 입력값입니다.');
      return;
    }

    // 로딩 표시
    showLoading(loadingDiv);
    hideResult();
    hideError();

    try {
      // 동적 옵션 구성
      const options: any = {
        spreadsheetId,
        query
      };

      if (gid && gid.trim() !== '') {
        options.gid = gid.trim();
      }

      if (range && range.trim() !== '') {
        options.range = range.trim();
      }

      // API 호출
      const result = await sheetsService.querySpreadsheetWithOptions(options);

      // 결과 표시
      showResult(result);

    } catch (error: any) {
      console.error('API 호출 실패:', error);
      showError(error.message || '데이터 조회 중 오류가 발생했습니다.');
    } finally {
      hideLoading(loadingDiv);
    }
  });
}

// 결과 표시 함수
function showResult(data: any) {
  resultData.textContent = JSON.stringify(data, null, 2);
  resultDiv.style.display = 'block';
}

// 결과 숨기기 함수
function hideResult() {
  resultDiv.style.display = 'none';
  resultData.textContent = '';
}

// 오류 표시 함수
function showError(message: string) {
  errorMessage.textContent = message;
  errorDiv.style.display = 'block';
}

// 오류 숨기기 함수
function hideError() {
  errorDiv.style.display = 'none';
  errorMessage.textContent = '';
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('Sheets 테스트 페이지 로드 완료');
});
