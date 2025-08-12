import { MissionData } from "@/types/mission";

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

export async function fetchMissionData(): Promise<MissionData> {
  try {
    // 시트 설정 상수 (필요시 여기만 수정)
    const SHEET = {
      spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
      sheetName: "[NEW] 생활소임_2학기",
      baseDate: "2025-07-17",
      baseRow: 159,
      startCol: "A",
      endCol: "R",
    } as const;

    // 날짜 기준으로 오늘 행의 range 계산 (클라이언트 계산)
    const today = new Date();
    const row = calculateRowFromDate(SHEET.baseDate, SHEET.baseRow, today);
    const range = `${SHEET.sheetName}!${SHEET.startCol}${row}:${SHEET.endCol}${row}`;

    // 백엔드 Sheets Read API 호출
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === "production" ? "" : "http://localhost:8080");
    const qs = new URLSearchParams({
      spreadsheet_id: SHEET.spreadsheetId,
      range,
    });
    const response = await fetch(`${baseUrl}/api/sheets/read?${qs.toString()}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch mission data");
    }

    const data: { values?: string[][] } = await response.json();
    const rawData: string[] = Array.isArray(data.values) && data.values.length > 0 ? data.values[0] : [];

    return processMissionData(rawData);
  } catch (error) {
    console.error("Error fetching mission data:", error);
    throw error;
  }
}

function processMissionData(rawData: string[]): MissionData {
  const cleanData = rawData.map((cell: string) =>
    cell && cell !== "-" ? cell : ""
  );

  return {
    date: cleanData[MISSION_INDICES.date] || "",
    dayOfWeek: cleanData[MISSION_INDICES.dayOfWeek] || "",
    morningMeal: getMissionMembers(cleanData, MISSION_INDICES.morningMeal),
    morningHelper: getMissionMembers(cleanData, MISSION_INDICES.morningHelper),
    morningDishes: getMissionMembers(cleanData, MISSION_INDICES.morningDishes),
    laundry: {
      wash: cleanData[MISSION_INDICES.laundry.wash] || undefined,
      hang: cleanData[MISSION_INDICES.laundry.hang] || undefined,
      fold: cleanData[MISSION_INDICES.laundry.fold] || undefined,
    },
    afternoonCushion: getMissionMembers(
      cleanData,
      MISSION_INDICES.afternoonCushion
    ),
    eveningMeal: getMissionMembers(cleanData, MISSION_INDICES.eveningMeal),
    eveningCushion: cleanData[MISSION_INDICES.eveningCushion] || undefined,
  };
}

function getMissionMembers(
  items: string[],
  indices: readonly number[]
): string[] {
  return indices.map((index) => items[index]).filter(Boolean);
}

// 로컬 타임존 기준 YYYY-MM-DD
function getLocalDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// baseDate(YYYY-MM-DD)부터의 일수 차이로 행 번호 계산
function calculateRowFromDate(baseDate: string, baseRow: number, targetDate: Date): number {
  const base = new Date(baseDate + "T00:00:00");
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((stripTime(targetDate).getTime() - base.getTime()) / dayMs);
  return baseRow + diffDays;
}

function stripTime(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
