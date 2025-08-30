import { apiClient } from "@/lib/api/client";
import { SheetsResponse } from "@/lib/types/sheets";

export async function sheetsRead(
  spreadsheetId: string,
  sheetName: string,
  query: string,
): Promise<SheetsResponse> {
  const qs = new URLSearchParams({
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    query: query,
  });
  return apiClient.get(`sheets/read?${qs.toString()}`).json<SheetsResponse>();
}

// POST 요청 공통 함수
async function sheetsPost(
  endpoint: string,
  spreadsheetId: string,
  sheetName: string,
  query: string,
): Promise<SheetsResponse> {
  return apiClient.post(endpoint, {
    json: {
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      query,
    }
  }).json<SheetsResponse>();
}

export const sheetsCreate = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("sheets/create", spreadsheetId, sheetName, query);

export const sheetsUpdate = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("sheets/update", spreadsheetId, sheetName, query);

export const sheetsDelete = (
  spreadsheetId: string,
  sheetName: string,
  query: string,
) => sheetsPost("sheets/delete", spreadsheetId, sheetName, query);

// 구글 시트 쿼리용 이스케이프
export function escapeSheetQueryString(s: string): string {
  return s.replace(/'/g, "''");
}
