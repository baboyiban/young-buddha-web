type SheetsResponse = any;

async function handleResponse(res: Response) {
  let body: any = undefined;
  try {
    body = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    console.error("sheets api failed", res.status, body);
    throw new Error(body?.message || `Sheets API error: ${res.status}`);
  }
  return body as SheetsResponse;
}

export async function sheetsRead(spreadsheetId: string, sheetName: string, query: string) {
  const qs = new URLSearchParams({
    spreadsheet_id: spreadsheetId,
    sheet_name: sheetName,
    read: query,
  });
  const res = await fetch(`/api/sheets/read?${qs.toString()}`, { credentials: 'include' });
  return handleResponse(res);
}

export async function sheetsCreate(spreadsheetId: string, sheetName: string, query: string) {
  const res = await fetch('/api/sheets/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, query }),
  });
  return handleResponse(res);
}

export async function sheetsUpdate(spreadsheetId: string, sheetName: string, query: string) {
  const res = await fetch('/api/sheets/update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, query }),
  });
  return handleResponse(res);
}

export async function sheetsDelete(spreadsheetId: string, sheetName: string, query: string) {
  const res = await fetch('/api/sheets/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ spreadsheet_id: spreadsheetId, sheet_name: sheetName, query }),
  });
  return handleResponse(res);
}

// 간단한 쿼리 빌더
export function escapeSheetString(s: string) {
  return s.replace(/'/g, "''");
}
