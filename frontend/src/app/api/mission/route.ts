import { NextResponse } from "next/server";

// 임시 목업 데이터 - 실제로는 백엔드 API나 Google Sheets에서 데이터를 가져와야 함
const mockMissionData = [
  "2025-01-15", // date
  "수", // dayOfWeek
  "김철수", // morningMeal[0]
  "이영희", // morningMeal[1]
  "박민수", // morningHelper[0]
  "정수진", // morningHelper[1]
  "최영수", // morningDishes[0]
  "한지민", // morningDishes[1]
  "송민호", // morningDishes[2]
  "김영진", // laundry.wash
  "이수정", // laundry.hang
  "박준호", // laundry.fold
  "정민아", // afternoonCushion[0]
  "최수빈", // afternoonCushion[1]
  "한민수", // eveningMeal[0]
  "송지은", // eveningMeal[1]
  "김태현", // eveningMeal[2]
  "이현주", // eveningCushion
];

export async function GET() {
  try {
    // 실제 구현에서는 여기서 백엔드 API를 호출하거나 Google Sheets API를 사용
    // const response = await fetch('http://localhost:8080/api/mission')
    // const data = await response.json()

    return NextResponse.json(mockMissionData);
  } catch (error) {
    console.error("Error fetching mission data:", error);
    return NextResponse.json(
      { error: "Failed to fetch mission data" },
      { status: 500 }
    );
  }
}
