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
use crate::types::{QueryParams, CommonParams, ApiError};
use crate::auth_tokens::authenticate_and_get_token;
use crate::routes::sheets_client;
use crate::routes::sheets_parser;

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

    let client = &state.http_client;

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
            match sheets_parser::parse_gviz_json(&text) {
                Ok(v) => (StatusCode::OK, Json(v)).into_response(),
                Err(e) => e.into_response(),
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

    let client = &state.http_client;

    // 2. 전체 시트 데이터 조회
    let rows_all = match sheets_client::fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
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
    let sheet_id = match sheets_client::get_sheet_id_by_name(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
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
            
            return match sheets_client::sheets_api_write_with_token(&client, &params.spreadsheet_id, &clear_range, &[empty_values], &user_token).await {
                Ok(()) => {
                    tracing::info!(target="sheets", id = %target_id, row = delete_row_index, range = %clear_range, "row cleared (fallback method)");
                    (StatusCode::OK, Json(json!({ "success": true, "deleted": 1, "method": "clear" }))).into_response()
                }
                Err(e) => ApiError::bad_gateway("SHEETS_WRITE_FAILED", format!("행 삭제 실패: {}", e)).into_response()
            };
        }
    };

    // 실제 행 삭제 실행
    match sheets_client::sheets_api_delete_row_with_token(&client, &params.spreadsheet_id, sheet_id, delete_row_index - 1, &user_token).await {
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
            
            match sheets_client::sheets_api_write_with_token(&client, &params.spreadsheet_id, &clear_range, &[empty_values], &user_token).await {
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

    let client = &state.http_client;

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
    match sheets_client::sheets_api_append_with_token(&client, &params.spreadsheet_id, &range, &[values_vec], &user_token).await {
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

    let client = &state.http_client;

    // 2. UPDATE 쿼리 파싱
    let (target_id, values_vec) = match parse_update_query(&params.query) {
        Ok((id, values)) => (id, values),
        Err(err) => return err.into_response(),
    };

    // 3. 전체 시트 데이터 조회 (Sheets API v4 사용으로 정확한 행 번호 확인)
    let rows_all = match sheets_client::fetch_all_sheet_data_v4(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await {
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
    
    match sheets_client::sheets_api_write_with_token(&client, &params.spreadsheet_id, &range, &[values_vec.clone()], &user_token).await {
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

// ======== Helpers ========

// ======== Helpers ========

// 공통 인증 및 토큰 검증
// authenticate_and_get_token moved to `auth_tokens.rs`

// sheet helpers moved to `sheets_client` and parser moved to `sheets_parser`
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
