import { MissionData } from "@/lib/types/mission";
import { sheetsRead } from "@/lib/api/sheets/client";
import { SheetsCell, SheetsRow, SheetsData } from "@/lib/types/sheets";
import { ApiError } from "@/lib/errors";

// 상수 정의
const SHEET_CONFIG = {
  spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
  gid: "257537053",
} as const;

const MISSION_INDICES = {
  date: 0, // A (날짜, 예: 10월 12일)
  dayOfWeek: 1, // B (요일)
  morningMeal: [2, 3] as const, // C, D (발공 당번 2칸)
  morningDishes: [10, 11, 12] as const, // K, L, M (설거지 3칸)
  eveningMeal: [18, 19] as const, // S, T (저녁 공당 2칸)
  eveningMeeting: 21, // V (닫는 모임)
} as const;

export async function fetchMissionData(): Promise<MissionData> {
  const today = new Date();
  const todayStr = getLocalDateYmd(today);
  const koreanDateStr = getKoreanDate(today);

  // Google Sheets의 날짜 형식에 맞춰 쿼리 (10월 11일 형식)
  let query = `SELECT * WHERE A = '${koreanDateStr}'`;
  let data = (await sheetsRead(
    SHEET_CONFIG.spreadsheetId,
    SHEET_CONFIG.gid,
    query,
  )) as SheetsData;
  let rows: SheetsRow[] = data.table?.rows ?? [];

  // 첫 번째 시도 실패 시 ISO 형식으로 재시도
  if (rows.length === 0) {
    query = `SELECT * WHERE A = date '${todayStr}'`;
    data = (await sheetsRead(
      SHEET_CONFIG.spreadsheetId,
      SHEET_CONFIG.gid,
      query,
    )) as SheetsData;
    rows = data.table?.rows ?? [];
  }

  if (rows.length === 0) {
    // 빈 데이터인 경우 기본 구조 반환
    return {
      date: "",
      dayOfWeek: "",
      morningMeal: [],
      morningDishes: [],
      eveningMeal: [],
      eveningMeeting: undefined,
    };
  }

  const firstRow = rows[0];
  const cells = firstRow.c ?? [];
  const rawData: string[] = cells.map(cellToDisplayString);

  return processMissionData(rawData);
}

function processMissionData(rawData: string[]): MissionData {
  return {
    date: normalizeToKoreanDate(rawData[MISSION_INDICES.date]) || "",
    dayOfWeek:
      rawData[MISSION_INDICES.dayOfWeek] ||
      deriveKoreanWeekday(rawData[MISSION_INDICES.date]),
    morningMeal: getMissionMembers(rawData, MISSION_INDICES.morningMeal),
    morningDishes: getMissionMembers(rawData, MISSION_INDICES.morningDishes),
    eveningMeal: getMissionMembers(rawData, MISSION_INDICES.eveningMeal),
    eveningMeeting: rawData[MISSION_INDICES.eveningMeeting] || undefined,
  };
}

function getMissionMembers(
  items: string[],
  indices: readonly number[],
): string[] {
  return indices
    .flatMap((index) => items[index]?.split(/[,/]/) ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
}

function getLocalDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getKoreanDate(d: Date = new Date()): string {
  const month = d.getMonth() + 1;
  const day = d.getDate();
  return `${month}월 ${day}일`;
}

function cellToDisplayString(cell?: SheetsCell): string {
  if (!cell) return "";
  if (cell.f && typeof cell.f === "string" && cell.f.trim().length > 0) {
    return cell.f;
  }
  const v = cell.v;
  if (v === null || v === undefined || v === "-") return "";
  if (typeof v === "string") {
    const m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,[^)]*)?\)$/);
    if (m) {
      const yyyy = parseInt(m[1], 10);
      const mm = String(parseInt(m[2], 10) + 1).padStart(2, "0");
      const dd = String(parseInt(m[3], 10)).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return v;
  }
  return String(v);
}

function normalizeToKoreanDate(s?: string): string {
  if (!s) return "";
  if (/^\d{4}년\s*\d{1,2}월/.test(s)) return s;
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m1) {
    const yyyy = m1[1];
    const mm = String(parseInt(m1[2], 10));
    const dd = String(parseInt(m1[3], 10));
    return `${yyyy}년 ${mm}월 ${dd}일`;
  }
  const m2 = s.match(/^Date\((\d+),(\d+),(\d+)(?:,[^)]*)?\)$/);
  if (m2) {
    const yyyy = m2[1];
    const mm = String(parseInt(m2[2], 10) + 1);
    const dd = String(parseInt(m2[3], 10));
    return `${yyyy}년 ${mm}월 ${dd}일`;
  }
  const parsed = Date.parse(s);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    return dt.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  return s;
}

function deriveKoreanWeekday(dateStr?: string): string {
  if (!dateStr) return "";
  let iso: string | null = null;
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    iso = new Date(yyyy, mm - 1, dd).toISOString();
  } else {
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) iso = new Date(parsed).toISOString();
  }
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("ko-KR", { weekday: "long" });
}
