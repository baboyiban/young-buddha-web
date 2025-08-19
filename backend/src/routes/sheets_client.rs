use serde_json::json;
use serde_json::Value;
use crate::types::ApiError;
use reqwest;
use crate::routes::sheets_parser;

// OAuth 토큰으로 스프레드시트 쓰기
pub async fn sheets_api_write_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    range: &str,
    values: &[Vec<String>],
    access_token: &str,
) -> Result<(), String> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?valueInputOption=RAW",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(range)
    );

    let body = json!({
        "values": values,
        "majorDimension": "ROWS"
    });

    let resp = client
        .put(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("네트워크 요청 실패: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Sheets API 오류 {}: {}", status, body));
    }

    Ok(())
}

// OAuth 토큰으로 스프레드시트에 행을 append
pub async fn sheets_api_append_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    range: &str,
    values: &[Vec<String>],
    access_token: &str,
) -> Result<(), String> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(range)
    );

    let body = json!({
        "values": values,
        "majorDimension": "ROWS"
    });

    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("네트워크 요청 실패: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Sheets API 오류 {}: {}", status, body));
    }

    Ok(())
}

// 실제 행 삭제 (batchUpdate 사용)
pub async fn sheets_api_delete_row_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    sheet_id: u32,
    row_index: usize,
    access_token: &str,
) -> Result<(), String> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}:batchUpdate",
        urlencoding::encode(spreadsheet_id)
    );

    let body = json!({
        "requests": [{
            "deleteDimension": {
                "range": {
                    "sheetId": sheet_id,
                    "dimension": "ROWS",
                    "startIndex": row_index,
                    "endIndex": row_index + 1
                }
            }
        }]
    });

    let resp = client
        .post(&url)
        .bearer_auth(access_token)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("네트워크 요청 실패: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Sheets API 오류 {}: {}", status, body));
    }

    Ok(())
}

// 시트 전체 데이터 조회 (Sheets API v4 사용)
pub async fn fetch_all_sheet_data_v4(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    sheet_name: &str,
    user_token: &str,
) -> Result<Vec<Vec<String>>, ApiError> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}!A:Z",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(sheet_name)
    );
    
    let resp = client.get(&url).bearer_auth(user_token).send().await
        .map_err(|_| ApiError::bad_gateway("NETWORK_FAILED", "네트워크 요청 실패"))?;
    
    if !resp.status().is_success() {
        return Err(ApiError::bad_gateway("SHEETS_API_FAILED", 
            format!("시트 전체 조회 실패: {}", resp.status())));
    }
    
    let data: Value = resp.json().await
        .map_err(|_| ApiError::bad_gateway("PARSE_FAILED", "JSON 파싱 실패"))?;
    
    let values = data.get("values")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    
    let mut result = Vec::new();
    for row in values {
        if let Some(row_array) = row.as_array() {
            let row_strings: Vec<String> = row_array.iter()
                .map(|cell| cell.as_str().unwrap_or("").to_string())
                .collect();
            result.push(row_strings);
        }
    }
    
    Ok(result)
}

// 시트 전체 데이터 조회 (Visualization API)
pub async fn fetch_all_sheet_data(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    sheet_name: &str,
    user_token: &str,
) -> Result<Vec<Value>, ApiError> {
    let all_query_url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        spreadsheet_id,
        urlencoding::encode("SELECT *"),
        urlencoding::encode(sheet_name)
    );
    
    let resp = client.get(&all_query_url).bearer_auth(user_token).send().await
        .map_err(|_| ApiError::bad_gateway("NETWORK_FAILED", "네트워크 요청 실패"))?;
    
    if !resp.status().is_success() {
        return Err(ApiError::bad_gateway("SHEETS_API_FAILED", 
        format!("시트 전체 조회 실패: {}", resp.status())));
    }
    
    let text = resp.text().await.unwrap_or_default();
    let parsed = sheets_parser::parse_gviz_json(&text)?;
    
    Ok(parsed.get("table")
        .and_then(|t| t.get("rows"))
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default())
}

// 시트 이름으로 시트 ID 조회
pub async fn get_sheet_id_by_name(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    sheet_name: &str,
    user_token: &str,
) -> Result<u32, ApiError> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}",
        urlencoding::encode(spreadsheet_id)
    );
    
    let resp = client.get(&url).bearer_auth(user_token).send().await
        .map_err(|_| ApiError::bad_gateway("NETWORK_FAILED", "네트워크 요청 실패"))?;
    
    if !resp.status().is_success() {
        return Err(ApiError::bad_gateway("SHEETS_API_FAILED", 
            format!("스프레드시트 메타데이터 조회 실패: {}", resp.status())));
    }
    
    let spreadsheet_data: Value = resp.json().await
        .map_err(|_| ApiError::bad_gateway("PARSE_FAILED", "JSON 파싱 실패"))?;

    if let Some(id) = find_sheet_id_in_spreadsheet(&spreadsheet_data, sheet_name) {
        return Ok(id);
    }

    Err(ApiError::not_found(format!("시트 '{}'를 찾을 수 없습니다", sheet_name)))
}

// Helper: find sheet id from parsed spreadsheet JSON. Separated for unit testing.
fn find_sheet_id_in_spreadsheet(spreadsheet_data: &Value, sheet_name: &str) -> Option<u32> {
    let sheets = spreadsheet_data.get("sheets")?.as_array()?;
    for sheet in sheets {
        let properties = sheet.get("properties")?;
        let title = properties.get("title").and_then(|t| t.as_str());
        let sheet_id = properties.get("sheetId").and_then(|id| id.as_u64());
        if let (Some(title), Some(id)) = (title, sheet_id) {
            if title == sheet_name {
                return Some(id as u32);
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::find_sheet_id_in_spreadsheet;
    use serde_json::json;

    #[test]
    fn finds_sheet_id_when_present() {
        let data = json!({
            "sheets": [
                { "properties": { "title": "Sheet1", "sheetId": 123 } },
                { "properties": { "title": "Data", "sheetId": 456 } }
            ]
        });
        let id = find_sheet_id_in_spreadsheet(&data, "Data");
        assert_eq!(id, Some(456));
    }

    #[test]
    fn returns_none_when_missing() {
        let data = json!({ "sheets": [] });
        let id = find_sheet_id_in_spreadsheet(&data, "Data");
        assert_eq!(id, None);
    }

    #[test]
    fn handles_missing_properties() {
        let data = json!({ "sheets": [ { "no_props": true } ] });
        let id = find_sheet_id_in_spreadsheet(&data, "Sheet1");
        assert_eq!(id, None);
    }
}
