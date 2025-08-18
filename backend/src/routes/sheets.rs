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
        .route("/sheets/read", get(read_values))
        .route("/sheets/write", post(write_values))
}

// ======== Types ========

#[derive(Debug, Deserialize)]
struct ReadParams {
    spreadsheet_id: String,
    range: String,
}

#[derive(Debug, Deserialize)]
struct WriteParams {
    spreadsheet_id: String,
    range: String,
    values: Vec<Vec<String>>,
    append: Option<bool>,
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

// ======== Handlers ========

// GET /api/sheets/read?spreadsheet_id=...&range=Sheet!A1:R1
async fn read_values(State(state): State<Arc<AppState>>, headers: HeaderMap, Query(params): Query<ReadParams>) -> impl IntoResponse {
    let client = reqwest::Client::new();

    // OAuth 사용자 인증 확인
    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": true,
                "code": "NOT_AUTHENTICATED",
                "message": "로그인이 필요합니다. OAuth 인증을 통해 로그인하세요.",
            })),
        ).into_response();
    };

    // 유효한 사용자 토큰 가져오기 (만료 시 자동 갱신)
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": true,
                "code": "TOKEN_UNAVAILABLE",
                "message": "유효한 Google 액세스 토큰이 없습니다. 다시 로그인하세요.",
            })),
        ).into_response();
    };

    // OAuth 토큰으로 Sheets API 호출
    match sheets_api_read_with_token(&client, &params.spreadsheet_id, &params.range, &user_token).await {
        Ok(values) => {
            (StatusCode::OK, Json(json!({ "values": values }))).into_response()
        }
        Err(e) => {
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": true,
                    "code": "SHEETS_API_FAILED",
                    "message": format!("스프레드시트 읽기 실패: {}", e),
                    "hint": "스프레드시트 ID와 범위를 확인하고, 해당 시트에 대한 읽기 권한이 있는지 확인하세요.",
                })),
            ).into_response()
        }
    }
}

// POST /api/sheets/write
async fn write_values(State(state): State<Arc<AppState>>, headers: HeaderMap, Json(params): Json<WriteParams>) -> impl IntoResponse {
    let client = reqwest::Client::new();

    // OAuth 사용자 인증 확인
    let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": true,
                "code": "NOT_AUTHENTICATED",
                "message": "로그인이 필요합니다. OAuth 인증을 통해 로그인하세요.",
            })),
        ).into_response();
    };

    // 유효한 사용자 토큰 가져오기 (만료 시 자동 갱신)
    let Some(user_token) = get_valid_user_token(&client, &state.db_path, &email).await else {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": true,
                "code": "TOKEN_UNAVAILABLE",
                "message": "유효한 Google 액세스 토큰이 없습니다. 다시 로그인하세요.",
            })),
        ).into_response();
    };

    // OAuth 토큰으로 Sheets API 쓰기 또는 append 호출
    let do_append = params.append.unwrap_or(false);
    let write_result = if do_append {
        sheets_api_append_with_token(&client, &params.spreadsheet_id, &params.range, &params.values, &user_token).await
    } else {
        sheets_api_write_with_token(&client, &params.spreadsheet_id, &params.range, &params.values, &user_token).await
    };

    match write_result {
        Ok(()) => {
            (StatusCode::OK, Json(json!({ "success": true, "message": "데이터가 성공적으로 저장되었습니다." }))).into_response()
        }
        Err(e) => {
            tracing::error!("Sheets write failed: {}", e);
            (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": true,
                    "code": "SHEETS_API_FAILED",
                    "message": format!("스프레드시트 쓰기 실패: {}", e),
                    "hint": "스프레드시트 ID와 범위를 확인하고, 해당 시트에 대한 쓰기 권한이 있는지 확인하세요.",
                })),
            ).into_response()
        }
    }
}

// ======== OAuth Sheets API Functions ========

// OAuth 토큰으로 스프레드시트 읽기
async fn sheets_api_read_with_token(
    client: &reqwest::Client,
    spreadsheet_id: &str,
    range: &str,
    access_token: &str,
) -> Result<Vec<Vec<String>>, String> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?majorDimension=ROWS",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(range)
    );

    let resp = client
        .get(&url)
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|e| format!("네트워크 요청 실패: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Sheets API 오류 {}: {}", status, body));
    }

    let v: Value = resp.json().await.map_err(|e| format!("응답 파싱 실패: {}", e))?;
    
    // { values: [[...], ...] } 형태에서 values 추출
    let values = v.get("values").and_then(|vv| vv.as_array()).cloned().unwrap_or_default();
    
    let result = values
        .into_iter()
        .map(|row| {
            row.as_array()
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .map(|cell| match cell {
                    Value::String(s) => s,
                    Value::Number(n) => n.to_string(),
                    Value::Bool(b) => if b { "true".to_string() } else { "false".to_string() },
                    Value::Null => String::new(),
                    other => other.to_string(),
                })
                .collect::<Vec<String>>()
        })
        .collect::<Vec<Vec<String>>>();

    Ok(result)
}

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