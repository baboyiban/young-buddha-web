import { PaymentRequest } from "@/app/payment/page";
import { PAYMENT_SHEET } from "@/lib/constants/sheets";
import { sheetsRead, escapeSheetQueryString } from "@/lib/api/sheetsClient";

type SheetsCell = { v?: any; f?: string | null };
type SheetsRow = { c?: SheetsCell[] };
type SheetsData = { table?: { rows?: SheetsRow[] } };

export async function fetchFilteredPayments(
  userName: string,
): Promise<PaymentRequest[]> {
  if (typeof userName !== "string" || !userName.trim()) {
    throw new Error("Invalid userName");
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
      const c = row.c ?? [];
      return {
        id: c[0]?.v ?? `${safeUserName}-${idx}`,
        name: c[1]?.v ?? "",
        type: c[2]?.v ?? "",
        requestDate: c[3]?.v ?? "",
        absentDate: c[4]?.v ?? "",
        schedule: c[5]?.v ?? "",
        reason: c[6]?.v ?? "",
        approved: c[7]?.v ?? "",
      };
    })
    .filter(
      (request: PaymentRequest) => !!request.id && request.id.trim() !== "",
    );
}
