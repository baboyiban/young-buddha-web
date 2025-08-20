use axum::http::HeaderMap;
// serde_json::json not used here
use crate::types::AppState;
use crate::types::ApiError;
use reqwest;
use rusqlite::OptionalExtension;
use std::time::{SystemTime, UNIX_EPOCH};
use time::OffsetDateTime;

// 공통 인증 및 토큰 검증
pub async fn authenticate_and_get_token(
    headers: &HeaderMap,
    state: &AppState,
) -> Result<(String, String), ApiError> {
    let client = &state.http_client;

    let email = get_email_from_jwt_cookie(headers, state.jwt_secret.as_deref())
        .ok_or_else(|| ApiError::unauthorized("로그인이 필요합니다."))?;

    let user_token = get_valid_user_token(client, &state.db_path, &email).await
        .ok_or_else(|| ApiError::unauthorized("유효한 Google 액세스 토큰이 없습니다."))?;

    Ok((email, user_token))
}

// JWT 쿠키에서 이메일 추출
// Note: keep implementation local to sheets module originally; expose a wrapper here for reuse
pub fn get_email_from_jwt_cookie(headers: &HeaderMap, jwt_secret: Option<&str>) -> Option<String> {
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
    match jsonwebtoken::decode::<crate::types::SheetsClaims>(
        &jwt_token,
        &jsonwebtoken::DecodingKey::from_secret(jwt_secret.as_bytes()),
        &jsonwebtoken::Validation::new(jsonwebtoken::Algorithm::HS256),
    ) {
        Ok(token_data) => {
            tracing::debug!("JWT validation successful in sheets (shared)");
            token_data.claims.email
        }
        Err(err) => {
            match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    tracing::warn!("JWT token expired in sheets API (shared)");
                }
                _ => {
                    tracing::warn!("JWT validation failed in sheets API (shared): {:?}", err.kind());
                }
            }
            None
        }
    }
}

// 만료 시 자동 refresh하여 유효 access_token 반환
pub async fn get_valid_user_token(
    client: &reqwest::Client,
    db_path: &str,
    email: &str,
) -> Option<String> {
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
pub async fn refresh_user_access_token(
    client: &reqwest::Client,
    db_path: &str,
    email: &str,
) -> Option<String> {
    // 2-1) DB에서 refresh_token 읽기 (blocking)
    let refresh_token: Option<String> = tokio::task::spawn_blocking({
        let db_path = db_path.to_string();
        let email = email.to_string();
        move || -> Option<String> {
            let db = rusqlite::Connection::open(&db_path).ok()?;
            let mut stmt = db
                .prepare("SELECT refresh_token FROM user_tokens WHERE email = ?1")
                .ok()?;
            stmt.query_row(rusqlite::params![email], |row| row.get::<_, Option<String>>(0))
                .optional()
                .ok()?
                .flatten()
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
    let gr: crate::types::GoogleRefreshResponse = resp.json().await.ok()?;

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

// Re-expose Redis-backed JWT cache helpers so other modules use auth_tokens as the
// single place for authentication/token related functionality.
#[allow(dead_code)]
pub async fn get_cached_jwt(token: &str) -> Option<serde_json::Value> {
    crate::auth::redis_cache::get_cached_jwt(token).await
}

#[allow(dead_code)]
pub async fn store_valid_jwt(token: &str, cached_obj: serde_json::Value) -> Result<(), ()> {
    crate::auth::redis_cache::store_valid_jwt(token, cached_obj).await
}
