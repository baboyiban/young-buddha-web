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
    // 클라이언트가 camelCase 또는 snake_case 둘 중 어떤 형식으로 보낼지 모를 수 있으므로 둘 다 처리
    const newPayment = {
      id: Date.now().toString(),
      name: body.name ?? body.user_name ?? '',
      // 클라이언트가 requestDate를 보냈다면 우선 사용, 아니면 서버 시간
      requestDate: (body.requestDate ?? body.request_date) || new Date().toISOString().split("T")[0],
      type: body.type ?? '',
      absentDate: body.absentDate ?? body.absent_date ?? '',
      // schedule/timeSlot 둘 다 처리
      schedule: body.schedule ?? body.timeSlot ?? body.time_slot ?? '',
      reason: body.reason ?? '',
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
