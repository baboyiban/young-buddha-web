import { createDateBasedRange, sheetsService } from "../lib/sheets";
import { authService } from "../lib/auth/service";
import type { SpreadsheetConfig } from "../types/sheet";

// 상수 정의
const MISSION_CONFIG = {
  baseDate: "2025-07-17",
  baseRow: 159,
  sheetName: "[NEW] 생활소임_2학기",
  spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
  columnRange: { start: "A", end: "R" },
} as const;

const UI_MESSAGES = {
  loading: "데이터를 불러오는 중...",
  noData: "데이터가 없습니다.",
  loginRequired: "로그인이 필요합니다.",
  loginButton: "로그인하기",
} as const;

let isLoading = false;

export async function loadMissionData(): Promise<void> {
  if (isLoading) return;

  const resultDiv = document.getElementById("sheet-home-result");
  if (!resultDiv) return;

  isLoading = true;
  resultDiv.innerHTML = UI_MESSAGES.loading;

  try {
    const isAuthenticated = await authService.checkAuthStatus();
    if (!isAuthenticated) {
      resultDiv.innerHTML = createLoginPrompt();
      return;
    }

    const data = await fetchMissionData();
    if (data.length === 0) {
      resultDiv.innerHTML = UI_MESSAGES.noData;
      return;
    }

    const missionItems = processMissionData(data[0]);
    resultDiv.innerHTML = createMissionHtml(missionItems);
  } catch (error) {
    resultDiv.innerHTML = createErrorMessage(error);
  } finally {
    isLoading = false;
  }
}

function createLoginPrompt(): string {
  return `
    <div class="text-center">
      <p class="mb-4">${UI_MESSAGES.loginRequired}</p>
      <button onclick="location.hash='#/login'" 
              class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
        ${UI_MESSAGES.loginButton}
      </button>
    </div>
  `;
}

async function fetchMissionData(): Promise<string[][]> {
  const range = createDateBasedRange(
    MISSION_CONFIG.sheetName,
    MISSION_CONFIG.baseDate,
    MISSION_CONFIG.baseRow,
    MISSION_CONFIG.columnRange.start,
    MISSION_CONFIG.columnRange.end
  );

  const config: SpreadsheetConfig = {
    spreadsheetId: MISSION_CONFIG.spreadsheetId,
    range,
  };

  return await sheetsService.readSpreadsheet(config);
}

function processMissionData(rawData: string[]): string[] {
  return rawData.map((cell: string) => (cell && cell !== "-" ? cell : ""));
}

function createErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `오류 발생: ${message}`;
}

// 미션 항목 인덱스 정의
const MISSION_INDICES = {
  date: 0,
  dayOfWeek: 1,
  morningMeal: [2, 3],
  morningHelper: [4, 5],
  morningDishes: [6, 7, 8],
  laundry: {
    wash: 9,
    hang: 10,
    fold: 11,
  },
  afternoonCushion: [12, 13],
  eveningMeal: [14, 15, 16],
  eveningCushion: 17,
} as const;

function createMissionHtml(items: string[]): string {
  const missions = [
    createMissionHeader(items),
    createMissionItemIfHasMembers(
      "🍚 발우공양 당번",
      getMissionMembers(items, MISSION_INDICES.morningMeal)
    ),
    createMissionItemIfHasMembers(
      "🤲 발우공양 바라지",
      getMissionMembers(items, MISSION_INDICES.morningHelper)
    ),
    createMissionItemIfHasMembers(
      "🧼 아침 설거지",
      getMissionMembers(items, MISSION_INDICES.morningDishes)
    ),
    createLaundryMissionIfHasMembers(items),
    createAfternoonCushionMissionIfHasMembers(items),
    createMissionItemIfHasMembers(
      "🍛 저녁공양 당번",
      getMissionMembers(items, MISSION_INDICES.eveningMeal)
    ),
    createMissionItemIfHasMembers(
      "🌚 저녁예불 방석 한줄깔기",
      items[MISSION_INDICES.eveningCushion] || ""
    ),
  ].filter(Boolean); // 빈 문자열 제거

  return `
    <div class="flex flex-col items-center justify-center-safe *:not-last:mb-[1rem] *:text-center *:*:not-last:mb-[0.25rem]">
      ${missions.join("")}
    </div>
  `;
}

function createMissionHeader(items: string[]): string {
  return `<div>🌴${items[MISSION_INDICES.date]} ${
    items[MISSION_INDICES.dayOfWeek]
  }요일 청년붓다 소임🌴</div>`;
}

function createMissionItem(title: string, members: string): string {
  return `<div><div>${title}</div><div>${members}</div></div>`;
}

function createMissionItemIfHasMembers(title: string, members: string): string {
  return members.trim() ? createMissionItem(title, members) : "";
}

function getMissionMembers(
  items: string[],
  indices: readonly number[]
): string {
  return indices
    .map((index) => items[index])
    .filter(Boolean)
    .join(", ");
}

function createLaundryMissionIfHasMembers(items: string[]): string {
  const laundryTasks = [
    items[MISSION_INDICES.laundry.wash]
      ? `(애벌/세탁) ${items[MISSION_INDICES.laundry.wash]}`
      : "",
    items[MISSION_INDICES.laundry.hang]
      ? `(널기) ${items[MISSION_INDICES.laundry.hang]}`
      : "",
    items[MISSION_INDICES.laundry.fold]
      ? `(걷고/개기) ${items[MISSION_INDICES.laundry.fold]}`
      : "",
  ]
    .filter(Boolean)
    .join(", ");

  return laundryTasks ? createMissionItem("🧺 걸레빨기", laundryTasks) : "";
}

function createAfternoonCushionMissionIfHasMembers(items: string[]): string {
  // 사시예불전 방석깔기는 특별 처리: 첫 번째 값이 없으면 "상근자 전원"으로 표시하되,
  // 모든 값이 비어있으면 숨김
  const hasAnyMember =
    items[MISSION_INDICES.afternoonCushion[0]] ||
    items[MISSION_INDICES.afternoonCushion[1]];

  if (!hasAnyMember) return "";

  const members = [
    items[MISSION_INDICES.afternoonCushion[0]] || "상근자 전원",
    items[MISSION_INDICES.afternoonCushion[1]],
  ]
    .filter(Boolean)
    .join(", ");

  return createMissionItem("🌞 사시예불전 방석깔기", members);
}
