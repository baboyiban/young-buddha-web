// lib/types/mission.ts (개선된 미션 타입)
export interface MissionData {
  date: string;
  dayOfWeek: string;

  // Optional new flexible structure
  assignments?: MissionAssignment[];

  // Legacy fields for backward compatibility
  morningMeal: string[];
  morningHelper: string[];
  morningDishes: string[];
  laundry: LaundryMission;
  afternoonCushion: string[];
  eveningMeal: string[];
  eveningCushion?: string;

  metadata?: {
    lastUpdated: string;
    source: string;
  };
}

export interface MissionAssignment {
  type: MissionType;
  title: string;
  members: string[];
  details?: MissionDetails;
}

export type MissionType =
  | "morningMeal"
  | "morningHelper"
  | "morningDishes"
  | "laundry"
  | "afternoonCushion"
  | "eveningMeal"
  | "eveningCushion";

export interface MissionDetails {
  time?: string;
  location?: string;
  instructions?: string;
  equipment?: string[];
}

export interface LaundryMission {
  wash?: string;
  hang?: string;
  fold?: string;
}
