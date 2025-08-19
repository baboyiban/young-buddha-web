type SheetsResponse = unknown;

async function handleResponse(res: Response): Promise<SheetsResponse> {
  let body: unknown = undefined;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  if (!res.ok) {
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? (body as any).message
        : `Sheets API error: ${res.status}`;
    console.error("sheets api failed", res.status, body);
    throw new Error(message);
  }
  return body;
}

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
  const res = await fetch(`/api/sheets/read?${qs.toString()}`, {
    credentials: "include",
  });
  return handleResponse(res);
}

// POST 요청 공통 함수
async function sheetsPost(
  endpoint: string,
  spreadsheetId: string,
  sheetName: string,
  query: string,
): Promise<SheetsResponse> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      query,
    }),
  });
  return handleResponse(res);
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
