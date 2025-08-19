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
        .route("/sheets/query", get(query_sheet))
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
    query: String,
}

// GET /api/sheets/query?spreadsheet_id=...&sheet_name=...&query=...
async fn query_sheet(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<QueryParams>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();
    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "NOT_AUTHENTICATED", "message": "로그인이 필요합니다." }))
        ).into_response();
    };
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "TOKEN_UNAVAILABLE", "message": "유효한 Google 액세스 토큰이 없습니다." }))
        ).into_response();
    };

    let url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode(&params.query),
        urlencoding::encode(&params.sheet_name)
    );
    let resp = client.get(&url)
        .bearer_auth(&user_token)
        .send().await;

    match resp {
        Ok(r) => {
            if !r.status().is_success() {
                let status = r.status();
                let body = r.text().await.unwrap_or_default();
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "SHEETS_API_FAILED", "message": format!("시트 쿼리 실패: {}", status), "body": body }))
                ).into_response();
            }
            let text = r.text().await.unwrap_or_default();
            // Visualization API는 JSONP 형식으로 반환하므로 파싱 필요
            let json_start = text.find('{').unwrap_or(0);
            let json_end = text.rfind('}').unwrap_or(text.len()-1);
            let json_str = &text[json_start..=json_end];
            let parsed: Result<Value, _> = serde_json::from_str(json_str);
            match parsed {
                Ok(v) => (StatusCode::OK, Json(v)).into_response(),
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "PARSE_FAILED", "message": format!("JSON 파싱 실패: {}", e), "raw": text }))
                ).into_response(),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": true, "code": "NETWORK_FAILED", "message": format!("네트워크 요청 실패: {}", e) }))
        ).into_response(),
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

// DELETE /api/sheets/delete
#[derive(Debug, Deserialize)]
struct DeleteQueryParams {
    spreadsheet_id: String,
    sheet_name: String,
    query: String,
}

async fn delete_by_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<DeleteQueryParams>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();
    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "NOT_AUTHENTICATED", "message": "로그인이 필요합니다." }))
        ).into_response();
    };
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "TOKEN_UNAVAILABLE", "message": "유효한 Google 액세스 토큰이 없습니다." }))
        ).into_response();
    };

    // 1. 먼저 쿼리로 행 찾기
    let query_url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode(&params.query),
        urlencoding::encode(&params.sheet_name)
    );
    let resp = client.get(&query_url)
        .bearer_auth(&user_token)
        .send().await;

    let rows = match resp {
        Ok(r) => {
            if !r.status().is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "SHEETS_API_FAILED", "message": format!("시트 쿼리 실패: {}", r.status()) }))
                ).into_response();
            }
            let text = r.text().await.unwrap_or_default();
            let json_start = text.find('{').unwrap_or(0);
            let json_end = text.rfind('}').unwrap_or(text.len()-1);
            let json_str = &text[json_start..=json_end];
            let parsed: Result<Value, _> = serde_json::from_str(json_str);
            match parsed {
                Ok(v) => {
                    v.get("table").and_then(|t| t.get("rows")).and_then(|r| r.as_array()).cloned().unwrap_or_default()
                }
                Err(_) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({ "error": true, "code": "PARSE_FAILED", "message": "JSON 파싱 실패" }))
                    ).into_response();
                }
            }
        }
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({ "error": true, "code": "NETWORK_FAILED", "message": format!("네트워크 요청 실패: {}", e) }))
            ).into_response();
        }
    };

    // 2. 전체 시트를 한 번 읽어서 A열(ID) -> 실제 행번호 매핑 생성
    let all_query_url = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
        params.spreadsheet_id,
        urlencoding::encode("SELECT *"),
        urlencoding::encode(&params.sheet_name)
    );
    let resp_all = client.get(&all_query_url).bearer_auth(&user_token).send().await;
    let rows_all = match resp_all {
        Ok(r) => {
            if !r.status().is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({ "error": true, "code": "SHEETS_API_FAILED", "message": format!("시트 전체 조회 실패: {}", r.status()) }))
                ).into_response();
            }
            let text = r.text().await.unwrap_or_default();
            let json_start = text.find('{').unwrap_or(0);
            let json_end = text.rfind('}').unwrap_or(text.len()-1);
            let json_str = &text[json_start..=json_end];
            let parsed: Result<Value, _> = serde_json::from_str(json_str);
            match parsed {
                Ok(v) => v.get("table").and_then(|t| t.get("rows")).and_then(|r| r.as_array()).cloned().unwrap_or_default(),
                Err(_) => vec![],
            }
        }
        Err(_) => vec![],
    };

    use std::collections::HashMap;
    let mut id_to_row_index: HashMap<String, usize> = HashMap::new();
    for (i, row) in rows_all.iter().enumerate() {
        let cells = row.get("c").and_then(|c| c.as_array()).cloned().unwrap_or_default();
        if let Some(id_val) = cells.get(0).and_then(|c| c.get("v")).and_then(|vv| vv.as_str()) {
            id_to_row_index.insert(id_val.to_string(), i + 2); // 데이터는 2행부터
        }
    }

    // 3. 선택된 행들에 대해 각자 실제 행 번호를 찾아 빈 값으로 덮어쓰기
    let mut deleted = 0usize;
    for row in rows.iter() {
        let cells = match row.get("c").and_then(|c| c.as_array()) { Some(c) => c, None => continue };
        if cells.is_empty() { continue; }
        let cells_len = cells.len();
        let id_val = match cells.get(0).and_then(|c| c.get("v")).and_then(|vv| vv.as_str()) { Some(v) => v, None => continue };
        let Some(row_index) = id_to_row_index.get(id_val).copied() else { continue };

    let values = vec!["".to_string(); cells_len];
    let end_col = number_to_column_letters(cells_len as u32);
    let range = format!("{}!A{}:{}{}", params.sheet_name, row_index, end_col, row_index);
        let write_result = sheets_api_write_with_token(
            &client,
            &params.spreadsheet_id,
            &range,
            &[values],
            &user_token,
        ).await;

        if write_result.is_ok() { deleted += 1; }
    }

    (StatusCode::OK, Json(json!({ "success": true, "deleted": deleted }))).into_response()
}

// ======== Handlers ========
// POST /api/sheets/create { spreadsheet_id, sheet_name, query }
// query DSL: "INSERT [\"col1\", \"col2\", ...]"
async fn create_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();

    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "NOT_AUTHENTICATED", "message": "로그인이 필요합니다." })),
        ).into_response();
    };
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "TOKEN_UNAVAILABLE", "message": "유효한 Google 액세스 토큰이 없습니다." })),
        ).into_response();
    };

    let q = params.query.trim();
    let Some(json_start) = q.strip_prefix("INSERT ") else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": true, "code": "INVALID_QUERY", "message": "INSERT 구문을 사용하세요: INSERT [\"...\"]" })),
        ).into_response();
    };

    let values_vec: Result<Vec<String>, _> = serde_json::from_str(json_start);
    let values_vec = match values_vec {
        Ok(v) => v,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": true, "code": "INVALID_VALUES", "message": format!("VALUES 파싱 실패: {}", e) })),
            ).into_response();
        }
    };

    let range = format!("{}!A:Z", params.sheet_name);
    match sheets_api_append_with_token(&client, &params.spreadsheet_id, &range, &[values_vec], &user_token).await {
        Ok(()) => (StatusCode::OK, Json(json!({ "success": true }))).into_response(),
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({ "error": true, "code": "SHEETS_WRITE_FAILED", "message": e })),
        ).into_response(),
    }
}

// POST /api/sheets/update { spreadsheet_id, sheet_name, query }
// query DSL: "UPDATE id=<ROW_ID> VALUES [\"col1\", \"col2\", ...]"
async fn update_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    let client = reqwest::Client::new();

    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "NOT_AUTHENTICATED", "message": "로그인이 필요합니다." })),
        ).into_response();
    };
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({ "error": true, "code": "TOKEN_UNAVAILABLE", "message": "유효한 Google 액세스 토큰이 없습니다." })),
        ).into_response();
    };

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
            let json_start = text.find('{').unwrap_or(0);
            let json_end = text.rfind('}').unwrap_or(text.len()-1);
            let json_str = &text[json_start..=json_end];
            let parsed: Result<Value, _> = serde_json::from_str(json_str);
            match parsed {
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
            let json_start = text.find('{').unwrap_or(0);
            let json_end = text.rfind('}').unwrap_or(text.len()-1);
            let json_str = &text[json_start..=json_end];
            let parsed: Result<Value, _> = serde_json::from_str(json_str);
            match parsed {
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
