use axum::{
    extract::{Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use crate::state::AppState;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use rusqlite::OptionalExtension;

// Public router (OAuth only)
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        // Deprecated: "/sheets/query" -> New preferred: "/sheets/read"
        .route("/sheets/query", get(query_sheet))
        .route("/sheets/read", get(query_sheet))
    // CRUD with unified parameters: spreadsheet_id, sheet_name, query
    .route("/sheets/create", post(create_with_query))
    .route("/sheets/update", post(update_with_query))
        .route("/sheets/delete", post(delete_by_query))
}
// Visualization API Query Language 기반 쿼리 핸들러
#[derive(Debug, Deserialize)]
struct QueryParams {
    spreadsheet_id: String,
    sheet_name: String,
    // allow alias "read" for backward/forward compatibility when renaming
    #[serde(alias = "read")]
    query: String,
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

// ======== Types ========

// 공통 파라미터 (CRUD 모두 동일한 형식: spreadsheet_id, sheet_name, query)
#[derive(Debug, Deserialize)]
struct CommonParams {
    spreadsheet_id: String,
    sheet_name: String,
    query: String,
}

// Google refresh token 응답
#[derive(Deserialize)]
struct GoogleRefreshResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: Option<String>,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
}

// 에러 응답 타입
#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "NOT_AUTHENTICATED", message)
    }

    fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }

    fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "ROW_NOT_FOUND", message)
    }

    fn bad_gateway(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, code, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(json!({
                "error": true,
                "code": self.code,
                "message": self.message
            }))
        ).into_response()
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
        return ApiError::not_found("삭제할 대상 행을 찾지 못했습니다.").into_response();
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

    // Parse query: UPDATE id=... VALUES [...]
    let q = params.query.trim();
    let Some(rest) = q.strip_prefix("UPDATE ") else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": true, "code": "INVALID_QUERY", "message": "UPDATE 구문을 사용하세요: UPDATE id=<...> VALUES [\"...\"]" })),
        ).into_response();
    };

    let (id_part, values_part) = match rest.split_once("VALUES") {
        Some((a, b)) => (a.trim(), b.trim()),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": true, "code": "INVALID_QUERY", "message": "VALUES 섹션이 필요합니다." })),
            ).into_response();
        }
    };

    let id = match id_part.strip_prefix("id=") {
        Some(v) => v.trim().trim_matches('\'').trim_matches('"').to_string(),
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": true, "code": "INVALID_QUERY", "message": "id=<...> 형식이 필요합니다." })),
            ).into_response();
        }
    };

    let values_vec: Result<Vec<String>, _> = serde_json::from_str(values_part);
    let values_vec = match values_vec {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": true, "code": "INVALID_VALUES", "message": format!("VALUES 파싱 실패: {}", e) })),
            ).into_response();
        }
    };

    // 1) 행 위치 조회: Visualization API로 A열(id) 기준으로 검색
    let query_url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode(&format!("SELECT * WHERE A = '{}'", id)),
        urlencoding::encode(&params.sheet_name)
    );

    let resp = client.get(&query_url).bearer_auth(&user_token).send().await;
    let (_row_index_hint, _cells_len) = match resp {
        Ok(r) => {
            if !r.status().is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "SHEETS_API_FAILED", "message": format!("시트 쿼리 실패: {}", r.status()) })),
                ).into_response();
            }
            let text = r.text().await.unwrap_or_default();
            match parse_gviz_json(&text) {
                Ok(v) => {
                    let rows = v.get("table").and_then(|t| t.get("rows")).and_then(|r| r.as_array()).cloned().unwrap_or_default();
                    if rows.is_empty() {
                        return (
                            StatusCode::NOT_FOUND,
                            Json(json!({ "error": true, "code": "ROW_NOT_FOUND", "message": "해당 id의 행을 찾을 수 없습니다." })),
                        ).into_response();
                    }
                    let first_row = rows[0].clone();
                    let cells = first_row.get("c").and_then(|c| c.as_array()).cloned().unwrap_or_default();
                    let cells_len = cells.len();
                    // Visualization API는 헤더가 1행이고 데이터가 2행부터라고 가정
                    (Some(2usize), cells_len)
                }
                Err(_) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": true, "code": "PARSE_FAILED", "message": "JSON 파싱 실패" })),
                    ).into_response();
                }
            }
        }
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": true, "code": "NETWORK_FAILED", "message": format!("네트워크 요청 실패: {}", e) })),
            ).into_response();
        }
    };

    // row_index_opt는 데이터의 첫 행이 몇 번째 실제 행인지 필요. 위에서 2로 시작하지만,
    // 실제 대상 행 번호는 결과의 첫 번째 행의 인덱스를 알아야 한다. 간단화를 위해 id는 유일하고,
    // 해당 id를 가진 행이 결과 rows[0]이며, 실제 행 번호는 헤더 다음 줄부터 i+2.
    // 위 파싱에서 i를 구하지 않았으므로 다시 rows 위치를 알아야 한다. 간략히 다시 쿼리하여 전체 시트를 가져와 위치를 찾는다.

    // 전체 시트에서 id로 위치 찾기 (성능보다 단순함 우선)
    let all_query_url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode("SELECT *"),
        urlencoding::encode(&params.sheet_name)
    );
    let resp_all = client.get(&all_query_url).bearer_auth(&user_token).send().await;
    let row_index = match resp_all {
        Ok(r) => {
            if !r.status().is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "SHEETS_API_FAILED", "message": format!("시트 전체 조회 실패: {}", r.status()) })),
                ).into_response();
            }
            let text = r.text().await.unwrap_or_default();
            match parse_gviz_json(&text) {
                Ok(v) => {
                    let rows = v.get("table").and_then(|t| t.get("rows")).and_then(|r| r.as_array()).cloned().unwrap_or_default();
                    let mut target_row_index: Option<usize> = None;
                    for (i, row) in rows.iter().enumerate() {
                        let cells = row.get("c").and_then(|c| c.as_array()).cloned().unwrap_or_default();
                        let a_val = cells.get(0).and_then(|c| c.get("v")).and_then(|vv| vv.as_str()).unwrap_or("");
                        if a_val == id {
                            target_row_index = Some(i + 2); // 헤더 1행, 데이터 2행부터
                            break;
                        }
                    }
                    match target_row_index {
                        Some(idx) => idx,
                        None => {
                            return (
                                StatusCode::NOT_FOUND,
                                Json(json!({ "error": true, "code": "ROW_NOT_FOUND", "message": "해당 id의 행을 찾을 수 없습니다." })),
                            ).into_response();
                        }
                    }
                }
                Err(_) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": true, "code": "PARSE_FAILED", "message": "JSON 파싱 실패" })),
                    ).into_response();
                }
            }
        }
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": true, "code": "NETWORK_FAILED", "message": format!("네트워크 요청 실패: {}", e) })),
            ).into_response();
        }
    };

    // 2) 대상 행에 전체 값을 덮어쓰기
    let end_col = number_to_column_letters(values_vec.len() as u32);
    let range = format!("{}!A{}:{}{}", params.sheet_name, row_index, end_col, row_index);
    match sheets_api_write_with_token(&client, &params.spreadsheet_id, &range, &[values_vec], &user_token).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "success": true, "row": row_index }))).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": true, "code": "SHEETS_WRITE_FAILED", "message": e })),
        ).into_response(),
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

// 시트 전체 데이터 조회
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
    #[derive(serde::Deserialize)]
    struct Claims {
        email: Option<String>,
    }

    match decode::<Claims>(
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
