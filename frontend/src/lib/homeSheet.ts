import { readSpreadsheetData, type SpreadsheetConfig } from './spreadsheetUtils';

export async function loadHomeSheetData() {
  const resultDiv = document.getElementById("sheet-home-result");
  if (!resultDiv) return;

  resultDiv.innerHTML = "데이터를 불러오는 중...";

  try {
    const config: SpreadsheetConfig = {
      spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
      range: "[NEW] 생활소임_2학기!A157:R157"
    };

    const data = await readSpreadsheetData(config);

    if (data.length === 0) {
      resultDiv.innerHTML = "데이터가 없습니다.";
      return;
    }

    // 첫 번째 행의 데이터만 표시
    const firstRow = data[0];
    const items = firstRow.filter(cell => cell && cell.trim()); // 빈 셀 제거

    if (items.length === 0) {
      resultDiv.innerHTML = "데이터가 없습니다.";
      return;
    }

    // 간단한 리스트로 표시
    const html = items.map(item => `<span>${item}</span>`).join(' | ');
    resultDiv.innerHTML = html;

  } catch (error) {
    resultDiv.innerHTML = `오류: ${error}`;
    console.error(error);
  }
}