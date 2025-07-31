import { createDateBasedRange, sheetsService } from "../lib/sheets";
import { authService } from "../lib/auth/service";
import type { SpreadsheetConfig } from "../types/sheet";

let isLoading = false;

export async function loadMissionData(): Promise<void> {
  if (isLoading) return;
  const resultDiv = document.getElementById("sheet-home-result");
  if (!resultDiv) return;

  isLoading = true;
  resultDiv.innerHTML = "데이터를 불러오는 중...";

  try {
    // 먼저 로그인 상태 확인
    const isAuthenticated = await authService.checkAuthStatus();
    if (!isAuthenticated) {
      resultDiv.innerHTML = `
        <div class="text-center">
          <p class="mb-4">로그인이 필요합니다.</p>
          <button onclick="location.hash='#/login'" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            로그인하기
          </button>
        </div>
      `;
      return;
    }
    const baseDate = "2025-07-17";
    const baseRow = 159;
    const sheetName = "[NEW] 생활소임_2학기";
    const range = createDateBasedRange(sheetName, baseDate, baseRow, "A", "R");

    const config: SpreadsheetConfig = {
      spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
      range,
    };

    const data = await sheetsService.readSpreadsheet(config);

    if (data.length === 0) {
      resultDiv.innerHTML = "데이터가 없습니다.";
      return;
    }

    const firstRow = data[0];
    const items = firstRow.map((cell: string) =>
      cell && cell !== "-" ? cell : ""
    );

    resultDiv.innerHTML = createMissionHtml(items);
  } catch (error) {
    resultDiv.innerHTML = `오류 발생: ${
      error instanceof Error ? error.message : String(error)
    }`;
  } finally {
    isLoading = false;
  }
}

function createMissionHtml(items: string[]): string {
  return `
    <div class="flex flex-col items-center justify-center-safe *:not-last:mb-[1rem] *:text-center *:*:not-last:mb-[0.25rem]">
      <div class="">🌴${items[0]} ${items[1]}요일 청년붓다 소임🌴</div>
      <div><div>🍚 발우공양 당번</div><div>${[items[2], items[3]]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🤲 발우공양 바라지</div><div>${[items[4], items[5]]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🧼 아침 설거지</div><div>${[items[6], items[7], items[8]]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🧺 걸레빨기</div><div>${[
        items[9] ? `(애벌/세탁) ${items[9]}` : "",
        items[10] ? `(널기) ${items[10]}` : "",
        items[11] ? `(걷고/개기) ${items[11]}` : "",
      ]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🌞 사시예불전 방석깔기</div><div>${[
        items[12] || "상근자 전원",
        items[13],
      ]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🍛 저녁공양 당번</div><div>${[items[14], items[15], items[16]]
        .filter(Boolean)
        .join(", ")}</div></div>
      <div><div>🌚 저녁예불 방석 한줄깔기</div><div>${[items[17]]}</div></div>
    </div>
  `;
}
