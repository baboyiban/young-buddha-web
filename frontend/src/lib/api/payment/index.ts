import { PaymentRequest } from "@/app/payment/page";
import { PAYMENT_SHEET } from "@/lib/api/sheets";
import { sheetsRead, escapeSheetString } from "@/lib/api/sheets/client";

type SheetsData = {
  table?: {
    rows?: Array<{
      c?: Array<{
        v?: any;
        f?: string | null;
      }>;
    }>;
  };
};

export async function fetchFilteredPayments(userName: string): Promise<PaymentRequest[]> {
  try {
    if (!userName || typeof userName !== "string") {
      throw new Error("유효하지 않은 사용자 이름입니다.");
    }
    
    const safeUserName = escapeSheetString(userName).slice(0, 200);
    const query = `SELECT * WHERE B = '${safeUserName}'`;
    
    const data: SheetsData = await sheetsRead(PAYMENT_SHEET.spreadsheetId, PAYMENT_SHEET.sheetName, query);
    
    // Visualization API JSON 구조에서 rows 추출
    const rows = data.table?.rows || [];
    
    // 각 row의 c 배열에서 값 추출
    return rows
      .map((row: any, idx: number) => {
        const cells = row.c || [];
        return {
          id: cells[0]?.v || `${userName}-${idx}`,
          name: cells[1]?.v || "",
          type: cells[2]?.v || "",
          requestDate: cells[3]?.v || "",
          absentDate: cells[4]?.v || "",
          schedule: cells[5]?.v || "",
          reason: cells[6]?.v || "",
          approved: cells[7]?.v || "",
        } as PaymentRequest;
      })
      .filter(
        (request: PaymentRequest) => request.id && request.id.trim() !== ""
      ); // 빈 행 필터링
  } catch (error) {
    console.error("결재 데이터 조회 실패:", error);
    throw new Error("결재 데이터를 불러오는데 실패했습니다.");
  }
}
