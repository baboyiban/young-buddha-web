import { MissionData } from "@/lib/types/mission";
import { sheetsRead } from "@/lib/api/sheets/client";
import { SheetsCell, SheetsRow, SheetsData } from "@/lib/types/sheets";

// 상수 정의
const SHEET_CONFIG = {
  spreadsheetId: "1-xSqaEHOOgIFs9yIh39wUp_oowYcXdQA0nwGZuhSJdQ",
  sheetName: "[NEW] 생활소임_2학기",
} as const;

const MISSION_INDICES = {
  date: 0, // A
  dayOfWeek: 1, // B
  morningMeal: [2, 3, 4] as const, // C, D, E
  morningHelper: [5, 6] as const, // F, G
  morningDishes: [7, 8, 9] as const, // H, I, J
  laundry: {
    wash: 10, // K
    hang: 11, // L
    fold: 12, // M
  },
  afternoonCushion: [13, 14] as const, // N, O
  eveningMeal: [15, 16, 17] as const, // P, Q, R
  eveningCushion: 18, // S
} as const;

export async function fetchMissionData(): Promise<MissionData> {
  const todayStr = getLocalDateYmd(new Date());

  let query = `SELECT * WHERE A = date '${todayStr}'`;
  let data = (await sheetsRead(
    SHEET_CONFIG.spreadsheetId,
    SHEET_CONFIG.sheetName,
    query,
  )) as SheetsData;
  let rows: SheetsRow[] = data.table?.rows ?? [];

  if (rows.length === 0) {
    query = `SELECT * WHERE A = '${todayStr}'`;
    data = (await sheetsRead(
      SHEET_CONFIG.spreadsheetId,
      SHEET_CONFIG.sheetName,
      query,
    )) as SheetsData;
    rows = data.table?.rows ?? [];
  }

  if (rows.length === 0) {
    throw new Error("미션 데이터를 불러오는데 실패했습니다.");
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
    morningHelper: getMissionMembers(rawData, MISSION_INDICES.morningHelper),
    morningDishes: getMissionMembers(rawData, MISSION_INDICES.morningDishes),
    laundry: {
      wash: rawData[MISSION_INDICES.laundry.wash] || undefined,
      hang: rawData[MISSION_INDICES.laundry.hang] || undefined,
      fold: rawData[MISSION_INDICES.laundry.fold] || undefined,
    },
    afternoonCushion: getMissionMembers(
      rawData,
      MISSION_INDICES.afternoonCushion,
    ),
    eveningMeal: getMissionMembers(rawData, MISSION_INDICES.eveningMeal),
    eveningCushion: rawData[MISSION_INDICES.eveningCushion] || undefined,
  };
}

function getMissionMembers(
  items: string[],
  indices: readonly number[],
): string[] {
  return indices
    .flatMap((index) => items[index]?.split(/[,\/]/) ?? [])
    .map((name) => name.trim())
    .filter(Boolean);
}

function getLocalDateYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
