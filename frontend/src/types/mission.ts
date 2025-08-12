export interface MissionData {
  date: string;
  dayOfWeek: string;
  morningMeal: string[];
  morningHelper: string[];
  morningDishes: string[];
  laundry: {
    wash?: string;
    hang?: string;
    fold?: string;
  };
  afternoonCushion: string[];
  eveningMeal: string[];
  eveningCushion?: string;
}
