use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::sync::Arc;
use crate::state::AppState;
use crate::types::{QueryParams, CommonParams, GoogleRefreshResponse, SheetsClaims, ApiError};
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use rusqlite::OptionalExtension;

// Public router (OAuth only)
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/sheets/read", get(query_sheet))
        .route("/sheets/create", post(create_with_query))
        .route("/sheets/update", post(update_with_query))
        .route("/sheets/delete", post(delete_by_query))
}


// GET /api/sheets/query?spreadsheet_id=...&sheet_name=...&query=...
async fn query_sheet(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<QueryParams>,
) -> impl IntoResponse {
    // 1. 인증 및 토큰 검증
    let (_email, user_token) = match authenticate_and_get_token(&headers, &state).await {
        Ok(tokens) => tokens,
        Err(err) => return err.into_response(),
    };

    let client = reqwest::Client::new();

    // 2. Visualization API 쿼리 실행
    let url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode(&params.query),
        urlencoding::encode(&params.sheet_name)
    );

    let resp = client.get(&url).bearer_auth(&user_token).send().await
        .map_err(|e| ApiError::bad_gateway("NETWORK_FAILED", format!("네트워크 요청 실패: {}", e)));

    match resp {
        Ok(r) => {
            if !r.status().is_success() {
                let status = r.status();
                let _body = r.text().await.unwrap_or_default();
                return ApiError::bad_gateway("SHEETS_API_FAILED", 
                    format!("시트 쿼리 실패: {}", status)).into_response();
            }
            
            let text = r.text().await.unwrap_or_default();
            match parse_gviz_json(&text) {
                Ok(v) => (StatusCode::OK, Json(v)).into_response(),
                Err(e) => ApiError::bad_gateway("PARSE_FAILED", e).into_response(),
            }
        }
        Err(err) => err.into_response(),
    }
}



async fn delete_by_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    // 1. 인증 및 토큰 검증
    let (_email, user_token) = match authenticate_and_get_token(&headers, &state).await {
        Ok(tokens) => tokens,
        Err(err) => return err.into_response(),
    };

    let client = reqwest::Client::new();

    // 2. 전체 시트 데이터 조회
    let rows_all = match fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
        Ok(rows) => rows,
        Err(err) => return err.into_response(),
    };

    // 3. 쿼리에서 대상 ID 추출
    let target_id = match extract_id_from_where_query(&params.query) {
        Ok(id) => id,
        Err(err) => return err.into_response(),
    };

    // 4. 대상 행 찾기
    let mut target_row_index: Option<usize> = None;
    
    for (i, row) in rows_all.iter().enumerate() {
        if let Some(id_val) = get_row_id(row) {
            tracing::debug!(target="sheets", i = i, id = %id_val, "checking row");
            if id_val == target_id {
                let calculated_row = i + 1; // Visualization API는 헤더 제외하고 반환하므로 +1만 필요
                tracing::info!(target="sheets", i = i, calculated_row = calculated_row, target_id = %target_id, "found target row");
                target_row_index = Some(calculated_row);
                break;
            }
        }
    }

    let Some(delete_row_index) = target_row_index else {
        tracing::warn!(target="sheets", target_id = %target_id, "Delete request for non-existent row - possibly already deleted");
        return ApiError::not_found("삭제할 대상 행을 찾지 못했습니다. 이미 삭제되었을 수 있습니다.").into_response();
    };

    // 5. 실제 행 삭제 (batchUpdate 사용)
    // 시트 ID 조회
    let sheet_id = match get_sheet_id_by_name(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
        Ok(id) => id,
        Err(err) => {
            tracing::warn!(target="sheets", error = ?err, "Failed to get sheet ID, falling back to clear method");
            // 시트 ID를 가져올 수 없으면 기존 방식(빈 값으로 덮어쓰기) 사용
            let target_row = &rows_all[delete_row_index - 2];
            let cells = target_row.get("c").and_then(|c| c.as_array()).cloned().unwrap_or_default();
            let max_cols = std::cmp::max(8, cells.len());
            
            let empty_values = vec!["".to_string(); max_cols];
            let end_col = number_to_column_letters(max_cols as u32);
            let clear_range = format!("{}!A{}:{}{}", params.sheet_name, delete_row_index, end_col, delete_row_index);
            
            return match sheets_api_write_with_token(&client, &params.spreadsheet_id, &clear_range, &[empty_values], &user_token).await {
                Ok(()) => {
                    tracing::info!(target="sheets", id = %target_id, row = delete_row_index, range = %clear_range, "row cleared (fallback method)");
                    (StatusCode::OK, Json(json!({ "success": true, "deleted": 1, "method": "clear" }))).into_response()
                }
                Err(e) => ApiError::bad_gateway("SHEETS_WRITE_FAILED", format!("행 삭제 실패: {}", e)).into_response()
            };
        }
    };

    // 실제 행 삭제 실행
    match sheets_api_delete_row_with_token(&client, &params.spreadsheet_id, sheet_id, delete_row_index - 1, &user_token).await {
        Ok(()) => {
            tracing::info!(target="sheets", id = %target_id, row = delete_row_index, sheet_id = sheet_id, "row actually deleted - other rows shifted up");
            (StatusCode::OK, Json(json!({ 
                "success": true, 
                "deleted": 1,
                "method": "actual_delete",
                "note": "Row actually deleted. Other rows shifted up to fill the gap."
            }))).into_response()
        }
        Err(e) => {
            tracing::error!(target="sheets", id = %target_id, row = delete_row_index, error = %e, "failed to delete row, trying fallback");
            // 실제 삭제 실패 시 기존 방식으로 폴백
            let target_row = &rows_all[delete_row_index - 2];
            let cells = target_row.get("c").and_then(|c| c.as_array()).cloned().unwrap_or_default();
            let max_cols = std::cmp::max(8, cells.len());
            
            let empty_values = vec!["".to_string(); max_cols];
            let end_col = number_to_column_letters(max_cols as u32);
            let clear_range = format!("{}!A{}:{}{}", params.sheet_name, delete_row_index, end_col, delete_row_index);
            
            match sheets_api_write_with_token(&client, &params.spreadsheet_id, &clear_range, &[empty_values], &user_token).await {
                Ok(()) => {
                    tracing::info!(target="sheets", id = %target_id, row = delete_row_index, range = %clear_range, "row cleared (fallback after delete failed)");
                    (StatusCode::OK, Json(json!({ "success": true, "deleted": 1, "method": "clear_fallback" }))).into_response()
                }
                Err(e2) => ApiError::bad_gateway("SHEETS_WRITE_FAILED", format!("행 삭제 및 클리어 모두 실패: {}, {}", e, e2)).into_response()
            }
        }
    }
}

// ======== Handlers ========
// POST /api/sheets/create { spreadsheet_id, sheet_name, query }
// query DSL: "INSERT [\"col1\", \"col2\", ...]"
async fn create_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    // 1. 인증 및 토큰 검증
    let (_email, user_token) = match authenticate_and_get_token(&headers, &state).await {
        Ok(tokens) => tokens,
        Err(err) => return err.into_response(),
    };

    let client = reqwest::Client::new();

    // 2. INSERT 쿼리 파싱
    let q = params.query.trim();
    let Some(json_start) = q.strip_prefix("INSERT ") else {
        return ApiError::bad_request("INVALID_QUERY", 
            "INSERT 구문을 사용하세요: INSERT [\"...\"]").into_response();
    };

    let values_vec: Vec<String> = match serde_json::from_str(json_start) {
        Ok(v) => v,
        Err(e) => return ApiError::bad_request("INVALID_VALUES", 
            format!("VALUES 파싱 실패: {}", e)).into_response(),
    };

    // 3. 시트에 데이터 추가
    let range = format!("{}!A:Z", params.sheet_name);
    match sheets_api_append_with_token(&client, &params.spreadsheet_id, &range, &[values_vec], &user_token).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) => ApiError::bad_gateway("SHEETS_WRITE_FAILED", e).into_response(),
    }
}

// UPDATE 쿼리에서 ID와 VALUES 추출
fn parse_update_query(query: &str) -> Result<(String, Vec<String>), ApiError> {
    let q = query.trim();
    let Some(rest) = q.strip_prefix("UPDATE ") else {
        return Err(ApiError::bad_request("INVALID_QUERY", 
            "UPDATE 구문을 사용하세요: UPDATE id=<...> VALUES [\"...\"]"));
    };

    let (id_part, values_part) = rest.split_once("VALUES")
        .ok_or_else(|| ApiError::bad_request("INVALID_QUERY", "VALUES 섹션이 필요합니다."))?;

    let id = id_part.strip_prefix("id=")
        .ok_or_else(|| ApiError::bad_request("INVALID_QUERY", "id=<...> 형식이 필요합니다."))?
        .trim()
        .trim_matches('\'')
        .trim_matches('"')
        .to_string();

    let values_vec: Vec<String> = serde_json::from_str(values_part.trim())
        .map_err(|e| ApiError::bad_request("INVALID_VALUES", format!("VALUES 파싱 실패: {}", e)))?;

    Ok((id, values_vec))
}

// POST /api/sheets/update { spreadsheet_id, sheet_name, query }
// query DSL: "UPDATE id=<ROW_ID> VALUES [\"col1\", \"col2\", ...]"
async fn update_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    // 1. 인증 및 토큰 검증
    let (_email, user_token) = match authenticate_and_get_token(&headers, &state).await {
        Ok(tokens) => tokens,
        Err(err) => return err.into_response(),
    };

    let client = reqwest::Client::new();

    // 2. UPDATE 쿼리 파싱
    let (target_id, values_vec) = match parse_update_query(&params.query) {
        Ok((id, values)) => (id, values),
        Err(err) => return err.into_response(),
    };

    // 3. 전체 시트 데이터 조회 (Sheets API v4 사용으로 정확한 행 번호 확인)
    let rows_all = match fetch_all_sheet_data_v4(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
        Ok(rows) => rows,
        Err(err) => return err.into_response(),
    };

    // 4. 대상 행 찾기 (실제 시트 행 번호 기준)
    let mut target_row_index: Option<usize> = None;
    
    for (i, row) in rows_all.iter().enumerate() {
        if let Some(id_val) = row.get(0) {
            if id_val == &target_id {
                let actual_row = i + 1; // Sheets API v4는 1-based 인덱스 (헤더 포함)
                tracing::info!(target="sheets", 
                    sheets_api_index = i, 
                    actual_sheet_row = actual_row, 
                    target_id = %target_id, 
                    "found target row for update using Sheets API v4");
                target_row_index = Some(actual_row);
                break;
            }
        }
    }

    let Some(row_index) = target_row_index else {
        return ApiError::not_found("수정할 대상 행을 찾지 못했습니다.").into_response();
    };

    // 5. 대상 행에 값 덮어쓰기
    let end_col = number_to_column_letters(values_vec.len() as u32);
    let range = format!("{}!A{}:{}{}", params.sheet_name, row_index, end_col, row_index);
    
    tracing::info!(target="sheets", 
        target_id = %target_id, 
        row = row_index, 
        range = %range, 
        values_count = values_vec.len(),
        "updating row with new values");
    
    match sheets_api_write_with_token(&client, &params.spreadsheet_id, &range, &[values_vec.clone()], &user_token).await {
        Ok(()) => {
            tracing::info!(target="sheets", 
                target_id = %target_id, 
                row = row_index, 
                values = ?values_vec,
                "row updated successfully - should overwrite existing row, not add new one");
            (StatusCode::OK, Json(json!({ "success": true, "row": row_index, "method": "update_existing" }))).into_response()
        }
        Err(e) => {
            tracing::error!(target="sheets", target_id = %target_id, row = row_index, error = %e, "failed to update row");
            ApiError::bad_gateway("SHEETS_WRITE_FAILED", e).into_response()
        }
    }
}

// A, B, ..., Z, AA, AB ...
fn number_to_column_letters(mut n: u32) -> String {
    // n: 1-based length -> letter
    // 1 -> A, 26 -> Z, 27 -> AA
    if n == 0 { return "A".to_string(); }
    let mut s = String::new();
    while n > 0 {
        let rem = (n - 1) % 26;
        s.insert(0, (b'A' + rem as u8) as char);
        n = (n - 1) / 26;
    }
    s
}

// ======== OAuth Sheets API Functions ========

// OAuth 토큰으로 스프레드시트 쓰기
async fn sheets_api_write_with_token(
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
async fn sheets_api_append_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    range: &str,
    values: &[Vec<String>],
    access_token: &str,
) -> Result<(), String> {
    // use the append endpoint
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
async fn sheets_api_delete_row_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    sheet_id: u32, // 시트 ID (시트 이름이 아님)
    row_index: usize, // 0-based 행 인덱스
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

// ======== Helpers ========

// 공통 인증 및 토큰 검증
async fn authenticate_and_get_token(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(String, String), ApiError> {
    let client = reqwest::Client::new();
    
    let email = get_email_from_jwt_cookie(headers, state.jwt_secret.as_deref())
        .ok_or_else(|| ApiError::unauthorized("로그인이 필요합니다."))?;
    
    let user_token = get_valid_user_token(&client, &state.db_path, &email).await
        .ok_or_else(|| ApiError::unauthorized("유효한 Google 액세스 토큰이 없습니다."))?;
    
    Ok((email, user_token))
}

// 시트 전체 데이터 조회 (Sheets API v4 사용)
async fn fetch_all_sheet_data_v4(
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

// 시트 전체 데이터 조회 (기존 Visualization API)
async fn fetch_all_sheet_data(
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
    let parsed = parse_gviz_json(&text)
        .map_err(|_| ApiError::bad_gateway("PARSE_FAILED", "JSON 파싱 실패"))?;
    
    Ok(parsed.get("table")
        .and_then(|t| t.get("rows"))
        .and_then(|r| r.as_array())
        .cloned()
        .unwrap_or_default())
}

// 시트 이름으로 시트 ID 조회
async fn get_sheet_id_by_name(
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
    
    let sheets = spreadsheet_data.get("sheets")
        .and_then(|s| s.as_array())
        .ok_or_else(|| ApiError::bad_gateway("PARSE_FAILED", "시트 목록을 찾을 수 없습니다"))?;
    
    for sheet in sheets {
        let properties = sheet.get("properties");
        let title = properties
            .and_then(|p| p.get("title"))
            .and_then(|t| t.as_str());
        let sheet_id = properties
            .and_then(|p| p.get("sheetId"))
            .and_then(|id| id.as_u64());
            
        if let (Some(title), Some(id)) = (title, sheet_id) {
            if title == sheet_name {
                return Ok(id as u32);
            }
        }
    }
    
    Err(ApiError::not_found(format!("시트 '{}'를 찾을 수 없습니다", sheet_name)))
}

// WHERE A = 'id' 쿼리에서 ID 추출
fn extract_id_from_where_query(query: &str) -> Result<String, ApiError> {
    let where_clause = query.strip_prefix("SELECT * WHERE A = '")
        .ok_or_else(|| ApiError::bad_request("INVALID_QUERY", 
            "지원되지 않는 쿼리 형식입니다. WHERE A = 'id' 형식만 지원합니다."))?;
    
    let end_pos = where_clause.find("'")
        .ok_or_else(|| ApiError::bad_request("INVALID_QUERY", "잘못된 쿼리 형식입니다."))?;
    
    Ok(where_clause[..end_pos].to_string())
}

// 행에서 ID 값 추출
fn get_row_id(row: &Value) -> Option<String> {
    row.get("c")
        .and_then(|c| c.as_array())
        .and_then(|cells| cells.get(0))
        .and_then(|cell| cell.get("v"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

// GViz(JSONP) 응답 텍스트에서 JSON 객체만 추출하여 파싱
fn parse_gviz_json(text: &str) -> Result<Value, String> {
    let json_start = text.find('{').ok_or_else(|| "GViz 응답에서 JSON 시작 위치를 찾지 못했습니다.".to_string())?;
    let json_end = text.rfind('}').ok_or_else(|| "GViz 응답에서 JSON 종료 위치를 찾지 못했습니다.".to_string())?;
    if json_end < json_start {
        return Err("GViz 응답의 JSON 범위가 올바르지 않습니다.".to_string());
    }
    let json_str = &text[json_start..=json_end];
    serde_json::from_str::<Value>(json_str).map_err(|e| format!("JSON 파싱 실패: {}", e))
}

// ======== JWT 및 토큰 관리 ========

// JWT 쿠키에서 이메일 추출
fn get_email_from_jwt_cookie(headers: &HeaderMap, jwt_secret: Option<&str>) -> Option<String> {
    let jwt_secret = jwt_secret?;
    let cookie_header = headers.get("cookie")?;
    let cookie_str = cookie_header.to_str().ok()?;
    
    // 쿠키에서 jwt 값 찾기
    let jwt_token = cookie_str
        .split(';')
        .find_map(|part| {
            let trimmed = part.trim();
            if let Some((key, value)) = trimmed.split_once('=') {
                if key == "jwt" {
                    Some(value.to_string())
                } else {
                    None
                }
            } else {
                None
            }
        })?;

    // JWT 디코딩

    match decode::<SheetsClaims>(
        &jwt_token,
        &DecodingKey::from_secret(jwt_secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    ) {
        Ok(token_data) => {
            tracing::debug!("JWT validation successful in sheets");
            token_data.claims.email
        }
        Err(err) => {
            match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    tracing::warn!("JWT token expired in sheets API");
                }
                _ => {
                    tracing::warn!("JWT validation failed in sheets API: {:?}", err.kind());
                }
            }
            None
        }
    }
}

// 만료 시 자동 refresh하여 유효 access_token 반환
async fn get_valid_user_token(
    client: &reqwest::Client,
    db_path: &str,
    email: &str,
) -> Option<String> {
    use std::time::{SystemTime, UNIX_EPOCH};

    // 1) DB에서 access_token, expires_at 읽기 (blocking)
    let row: Option<(String, i64)> = tokio::task::spawn_blocking({
        let db_path = db_path.to_string();
        let email = email.to_string();
        move || -> Option<(String, i64)> {
            let db = rusqlite::Connection::open(&db_path).ok()?;
            let mut stmt = db
                .prepare("SELECT access_token, expires_at FROM user_tokens WHERE email = ?1")
                .ok()?;
            let mut rows = stmt.query(rusqlite::params![email]).ok()?;
            if let Some(row) = rows.next().ok().flatten() {
                let access_token: String = row.get(0).ok()?;
                let expires_at: i64 = row.get(1).ok()?;
                Some((access_token, expires_at))
            } else {
                None
            }
        }
    })
    .await
    .ok()
    .flatten();

    if let Some((access_token, expires_at)) = row {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .ok()?
            .as_secs() as i64;
        if expires_at > now + 30 {
            return Some(access_token);
        }
    }

    // 2) 만료: refresh 시도
    refresh_user_access_token(client, db_path, email).await
}

// refresh_token으로 access_token 재발급
async fn refresh_user_access_token(
    client: &reqwest::Client,
    db_path: &str,
    email: &str,
) -> Option<String> {
    use time::OffsetDateTime;

    // 2-1) DB에서 refresh_token 읽기 (blocking)
    let refresh_token: Option<String> = tokio::task::spawn_blocking({
        let db_path = db_path.to_string();
        let email = email.to_string();
        move || -> Option<String> {
            let db = rusqlite::Connection::open(&db_path).ok()?;
            let mut stmt = db
                .prepare("SELECT refresh_token FROM user_tokens WHERE email = ?1")
                .ok()?;
            // optional()은 Row 없음도 None으로 바꿔줍니다.
            stmt.query_row(rusqlite::params![email], |row| row.get::<_, Option<String>>(0))
                .optional()  // Result<Option<String>> -> Result<Option<Option<String>>>
                .ok()?       // Result -> Option
                .flatten()   // Option<Option<String>> -> Option<String>
        }
    })
    .await
    .ok()
    .flatten();

    let refresh_token = refresh_token?;

    // 2-2) 구글 토큰 엔드포인트로 refresh 요청 (async)
    let client_id = std::env::var("GOOGLE_CLIENT_ID").ok()?;
    let client_secret = std::env::var("GOOGLE_CLIENT_SECRET").ok()?;
    let form = [
        ("grant_type", "refresh_token"),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("refresh_token", refresh_token.as_str()),
    ];

    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        tracing::warn!(target="auth", %status, body = %body, email = %email, "Google refresh_token request failed");
        return None;
    }
    let gr: GoogleRefreshResponse = resp.json().await.ok()?;

    let new_access = gr.access_token.clone();
    let expires_in = gr.expires_in.unwrap_or(3600);
    let new_expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;

    // 2-3) DB에 새 access_token(+Optional 새 refresh_token) 저장 (blocking)
    let _ = tokio::task::spawn_blocking({
        let db_path = db_path.to_string();
        let email = email.to_string();
        let new_access2 = new_access.clone();
        let new_expires_at2 = new_expires_at;
        let new_rt = gr.refresh_token.clone();
        move || {
            if let Ok(db) = rusqlite::Connection::open(&db_path) {
                let _ = db.execute(
                    "UPDATE user_tokens
                     SET access_token = ?1,
                         expires_at   = ?2,
                         refresh_token = COALESCE(?3, refresh_token)
                     WHERE email = ?4",
                    rusqlite::params![new_access2, new_expires_at2, new_rt, email],
                );
            }
        }
    })
    .await;

    Some(new_access)
}
