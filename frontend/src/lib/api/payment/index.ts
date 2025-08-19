import { PaymentRequest } from "@/app/payment/page";
import { PAYMENT_SHEET } from "@/lib/api/sheets";
import { sheetsRead, escapeSheetQueryString } from "@/lib/api/sheets/client";

type SheetsCell = { v?: any; f?: string | null };
type SheetsRow = { c?: SheetsCell[] };
type SheetsData = {
  table?: {
    rows?: SheetsRow[];
  };
};

export async function fetchFilteredPayments(
  userName: string,
): Promise<PaymentRequest[]> {
  if (!userName || typeof userName !== "string") {
    throw new Error("유효하지 않은 사용자 이름입니다.");
  }

  const safeUserName = escapeSheetQueryString(userName).slice(0, 200);
  const query = `SELECT * WHERE B = '${safeUserName}'`;

  const data = (await sheetsRead(
    PAYMENT_SHEET.spreadsheetId,
    PAYMENT_SHEET.sheetName,
    query,
  )) as SheetsData;

  const rows = data.table?.rows ?? [];

  return rows
    .map((row: SheetsRow, idx: number): PaymentRequest => {
      const cells = row.c ?? [];
      return {
        id: cells[0]?.v ?? `${safeUserName}-${idx}`,
        name: cells[1]?.v ?? "",
        type: cells[2]?.v ?? "",
        requestDate: cells[3]?.v ?? "",
        absentDate: cells[4]?.v ?? "",
        schedule: cells[5]?.v ?? "",
        reason: cells[6]?.v ?? "",
        approved: cells[7]?.v ?? "",
      };
    })
    .filter(
      (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
    );
}
