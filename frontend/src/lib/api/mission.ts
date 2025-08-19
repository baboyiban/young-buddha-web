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
      endCol: "R", // 최대 R열까지 사용
    } as const;

    // 오늘 날짜(YYYY-MM-DD) 기준으로 A열(날짜)에서 해당 행을 조회
    const todayStr = getLocalDateYmd(new Date());
    // 1차: 날짜 타입 셀인 경우 (GViz) -> date 'YYYY-MM-DD'
    let query = `SELECT * WHERE A = date '${todayStr}'`;

    // 백엔드 Sheets Query API 호출 (Next.js rewrites를 타도록 상대 경로 사용)
    const qs = new URLSearchParams({
      spreadsheet_id: SHEET.spreadsheetId,
      sheet_name: SHEET.sheetName,
      query,
    });
    const response = await fetch(`/api/sheets/query?${qs.toString()}`, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to fetch mission data");
    }

    let data: any = await response.json();
    let rows: any[] = data?.table?.rows || [];

    // 2차: 문자열로 저장된 경우 재조회
    if (rows.length === 0) {
      query = `SELECT * WHERE A = '${todayStr}'`;
      const qs2 = new URLSearchParams({
        spreadsheet_id: SHEET.spreadsheetId,
        sheet_name: SHEET.sheetName,
        query,
      });
      const res2 = await fetch(`/api/sheets/query?${qs2.toString()}`, { credentials: "include" });
      if (res2.ok) {
        data = await res2.json();
        rows = data?.table?.rows || [];
      }
    }
    const first = rows[0];
    const cells = (first?.c || []) as Array<{ v?: any; f?: string | null }>;
    const rawData: string[] = cells.map(cellToDisplayString);

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
    date: `${normalizeToKoreanDate(cleanData[MISSION_INDICES.date]) || ""} ${cleanData[MISSION_INDICES.dayOfWeek] || deriveKoreanWeekday(cleanData[MISSION_INDICES.date])}`.trim(),
    dayOfWeek: cleanData[MISSION_INDICES.dayOfWeek] || deriveKoreanWeekday(cleanData[MISSION_INDICES.date]),
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

// deprecated: 행 번호 계산 로직은 Visualization API 쿼리로 대체

// GViz 셀을 사람이 읽기 쉬운 문자열로 변환
function cellToDisplayString(cell?: { v?: any; f?: string | null }): string {
  if (!cell) return "";
  // 1) 포맷팅된 값이 있으면 우선 사용 (날짜/시간 등)
  if (cell.f && typeof cell.f === "string" && cell.f.trim().length > 0) {
    return cell.f;
  }
  const v = cell.v;
  if (v === null || v === undefined) return "";
  // 2) Date(yyyy,mm,dd[,hh,MM,ss]) 형태 문자열 처리
  if (typeof v === "string") {
    const m = v.match(/^Date\((\d+),(\d+),(\d+)(?:,[^)]*)?\)$/);
    if (m) {
      const yyyy = parseInt(m[1], 10);
      const mm0 = parseInt(m[2], 10); // 0-based month
      const dd = parseInt(m[3], 10);
      const mm = String(mm0 + 1).padStart(2, "0");
      const day = String(dd).padStart(2, "0");
      return `${yyyy}-${mm}-${day}`;
    }
    return v;
  }
  // 3) 숫자/불리언 등 일반 값 문자열화
  return String(v);
}

// YYYY-MM-DD 또는 Date(...) 또는 기타를 받아 "YYYY년 M월 D일"로 변환
function normalizeToKoreanDate(s?: string): string {
  if (!s) return ''
  // 이미 한글 포맷이면 그대로 반환
  if (/^\d{4}년\s*\d{1,2}월/.test(s)) return s

  // YYYY-MM-DD 형식
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m1) {
    const yyyy = m1[1]
    const mm = String(parseInt(m1[2], 10))
    const dd = String(parseInt(m1[3], 10))
    return `${yyyy}년 ${mm}월 ${dd}일`
  }

  // Date(yyyy,mm,dd) 형태
  const m2 = s.match(/^Date\((\d+),(\d+),(\d+)(?:,[^)]*)?\)$/)
  if (m2) {
    const yyyy = m2[1]
    const mm = String(parseInt(m2[2], 10) + 1)
    const dd = String(parseInt(m2[3], 10))
    return `${yyyy}년 ${mm}월 ${dd}일`
  }

  // fallback: try Date.parse
  const parsed = Date.parse(s)
  if (!isNaN(parsed)) {
    const dt = new Date(parsed)
    return dt.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return s
}

// 문자열 날짜에서 한국어 요일(예: 화요일)을 유도
function deriveKoreanWeekday(dateStr?: string): string {
  if (!dateStr) return ''
  // try normalized YYYY-MM-DD
  let iso = null as string | null
  const m = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) {
    const yyyy = Number(m[1])
    const mm = Number(m[2])
    const dd = Number(m[3])
    iso = new Date(yyyy, mm - 1, dd).toISOString()
  } else {
    const parsed = Date.parse(dateStr)
    if (!isNaN(parsed)) iso = new Date(parsed).toISOString()
  }
  if (!iso) return ''
  const wd = new Date(iso).toLocaleDateString('ko-KR', { weekday: 'long' })
  return wd
}
