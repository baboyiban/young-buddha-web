import { NextRequest, NextResponse } from "next/server";

// 임시 메모리 저장소 (실제로는 데이터베이스나 Google Sheets 사용)
let paymentRequests: any[] = [];

export async function GET(request: NextRequest) {
  try {
    // TODO: 실제 데이터베이스나 Google Sheets에서 데이터 조회
    return NextResponse.json(paymentRequests);
  } catch (error) {
    console.error("Payment list fetch error:", error);
    return NextResponse.json(
      { error: "결재 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 새 결재 요청 생성
    const newPayment = {
      id: Date.now().toString(),
      name: body.name,
      requestDate: new Date().toISOString().split("T")[0],
      type: body.type,
      absentDate: body.absent_date,
      timeSlot: body.time_slot,
      reason: body.reason,
      status: "대기",
      createdAt: new Date().toISOString(),
    };

    // TODO: 실제 데이터베이스나 Google Sheets에 저장
    paymentRequests.unshift(newPayment);

    return NextResponse.json({
      success: true,
      message: "결재 요청이 성공적으로 등록되었습니다.",
      data: newPayment,
    });
  } catch (error) {
    console.error("Payment request creation error:", error);
    return NextResponse.json(
      { error: "결재 요청 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}
