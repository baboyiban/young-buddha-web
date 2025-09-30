import { apiClient } from "@/lib/api/client";
import { SheetsResponse } from "@/lib/types/sheets";

export async function sheetsRead(
  spreadsheetId: string,
  gid: string,
  query: string,
): Promise<SheetsResponse> {
  const qs = new URLSearchParams({
    spreadsheet_id: spreadsheetId,
    gid: gid,
    query: query,
  });
  return apiClient.get(`sheets/read?${qs.toString()}`).json<SheetsResponse>();
}

// POST 요청 공통 함수
async function sheetsPost(
  endpoint: string,
  spreadsheetId: string,
  gid: string,
  query: string,
): Promise<SheetsResponse> {
  return apiClient.post(endpoint, {
    json: {
      spreadsheet_id: spreadsheetId,
      gid: gid,
      query,
    }
  }).json<SheetsResponse>();
}

export const sheetsCreate = (
  spreadsheetId: string,
  gid: string,
  query: string,
) => sheetsPost("sheets/create", spreadsheetId, gid, query);

export const sheetsUpdate = (
  spreadsheetId: string,
  gid: string,
  query: string,
) => sheetsPost("sheets/update", spreadsheetId, gid, query);

export const sheetsDelete = (
  spreadsheetId: string,
  gid: string,
  query: string,
) => sheetsPost("sheets/delete", spreadsheetId, gid, query);

// 구글 시트 쿼리용 이스케이프
export function escapeSheetQueryString(s: string): string {
  return s.replace(/'/g, "''");
}
