import { HttpClient } from "@/lib/config/http";

type SheetsResponse = unknown;

const httpClient = new HttpClient();

export async function sheetsRead(
  spreadsheetId: string,
  sheetName: string,
  query: string,
): Promise<SheetsResponse> {
  const qs = new URLSearchParams({
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    read: query,
  });
  return httpClient.get<SheetsResponse>(`/api/sheets/read?${qs.toString()}`);
}

// POST 요청 공통 함수
async function sheetsPost(
  endpoint: string,
  spreadsheetId: string,
  sheetName: string,
  query: string,
): Promise<SheetsResponse> {
  return httpClient.post<SheetsResponse>(endpoint, {
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    query,
  });
}

export const sheetsCreate = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("/api/sheets/create", spreadsheetId, sheetName, query);

export const sheetsUpdate = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("/api/sheets/update", spreadsheetId, sheetName, query);

export const sheetsDelete = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("/api/sheets/delete", spreadsheetId, sheetName, query);

// 구글 시트 쿼리용 이스케이프
export function escapeSheetQueryString(s: string): string {
  return s.replace(/'/g, "''");
}
