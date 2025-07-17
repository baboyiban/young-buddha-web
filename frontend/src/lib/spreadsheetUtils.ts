// 간단한 스프레드시트 데이터 가져오기 유틸리티

export interface SpreadsheetConfig {
  spreadsheetId: string;
  range: string;
}

// 스프레드시트 데이터 읽기
export async function readSpreadsheetData(config: SpreadsheetConfig): Promise<string[][]> {
  const res = await fetch(
    `/api/sheet/read?spreadsheet_id=${encodeURIComponent(config.spreadsheetId)}&range=${encodeURIComponent(config.range)}`,
    { credentials: "include" }
  );

  const responseText = await res.text();

  if (!res.ok) {
    throw new Error(`API 오류: ${res.status} - ${responseText.substring(0, 200)}`);
  }

  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`잘못된 응답 형식 (JSON이 아님) - ${responseText.substring(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (jsonError) {
    throw new Error(`JSON 파싱 오류 - ${responseText.substring(0, 200)} - ${jsonError}`);
  }

  if (!data.values || !Array.isArray(data.values)) {
    return []; // 빈 배열 반환
  }

  return data.values;
}

// 스프레드시트 데이터 저장
export async function writeSpreadsheetData(config: SpreadsheetConfig, values: string[][]): Promise<void> {
  const res = await fetch('/api/sheet/write', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      spreadsheet_id: config.spreadsheetId,
      range: config.range,
      values: values
    })
  });

  if (!res.ok) {
    throw new Error(`저장 실패: ${res.status}`);
  }
}