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
    // API 호출 (백엔드 API 엔드포인트로 수정 필요)
    const response = await fetch("/api/mission");

    if (!response.ok) {
      throw new Error("Failed to fetch mission data");
    }

    const rawData: string[] = await response.json();

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
