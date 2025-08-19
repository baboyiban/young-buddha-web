import { HttpClient } from "@/lib/config/http";

type SheetsResponse = any;

const httpClient = new HttpClient();

export async function sheetsRead(spreadsheetId: string, sheetName: string, query: string): Promise<SheetsResponse> {
  const qs = new URLSearchParams({
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    read: query,
  });
  return await httpClient.get<SheetsResponse>(`/api/sheets/read?${qs.toString()}`);
}

export async function sheetsCreate(spreadsheetId: string, sheetName: string, query: string): Promise<SheetsResponse> {
  return await httpClient.post<SheetsResponse>('/api/sheets/create', {
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    query,
  });
}

export async function sheetsUpdate(spreadsheetId: string, sheetName: string, query: string): Promise<SheetsResponse> {
  return await httpClient.post<SheetsResponse>('/api/sheets/update', {
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    query,
  });
}

export async function sheetsDelete(spreadsheetId: string, sheetName: string, query: string): Promise<SheetsResponse> {
  return await httpClient.post<SheetsResponse>('/api/sheets/delete', {
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    query,
  });
}

// 간단한 쿼리 빌더
export function escapeSheetString(s: string): string {
  return s.replace(/'/g, "''");
}
