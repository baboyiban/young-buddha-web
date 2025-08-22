#![allow(dead_code)]
use crate::types::{AppState, CallbackQuery, TokenResponse, GoogleUserInfo, JwtClaims, ApiError};
use crate::auth_tokens::get_email_from_jwt_cookie;
use axum::http::{HeaderMap, HeaderValue};
use jsonwebtoken::{encode, EncodingKey, Header as JwtHeader};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::Arc;
use time::OffsetDateTime;
use once_cell::sync::Lazy;

// JWT 토큰 유효 시간 설정 (초 단위)
const JWT_EXPIRY_SECONDS: i64 = 60 * 60 * 24 * 7; // 7일
const OAUTH_STATE_EXPIRY_SECONDS: i64 = 600; // 10분

// OAuth state 임시 저장소 (메모리)
static OAUTH_STATES: Lazy<Mutex<HashMap<String, i64>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub struct AuthService;

impl AuthService {
    // OAuth state 관리 함수들
    pub fn store_oauth_state(state: &str) {
        let expiry = OffsetDateTime::now_utc().unix_timestamp() + OAUTH_STATE_EXPIRY_SECONDS;
        if let Ok(mut states) = OAUTH_STATES.lock() {
            states.insert(state.to_string(), expiry);
            // 만료된 state들 정리
            let now = OffsetDateTime::now_utc().unix_timestamp();
            states.retain(|_, &mut exp| exp > now);
        }
    }

    pub fn verify_oauth_state(state: &str) -> bool {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        if let Ok(mut states) = OAUTH_STATES.lock() {
            if let Some(&expiry) = states.get(state) {
                if expiry > now {
                    states.remove(state); // 사용된 state는 제거
                    return true;
                }
            }
            // 만료된 state들 정리
            states.retain(|_, &mut exp| exp > now);
        }
        false
    }

    pub fn generate_oauth_state() -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(32)
            .map(char::from)
            .collect()
    }

    pub fn create_jwt_token(name: &str, email: &str, role: &str, jwt_secret: &str) -> Result<String, ApiError> {
        let expiry = OffsetDateTime::now_utc().unix_timestamp() + JWT_EXPIRY_SECONDS;
        let claims = JwtClaims {
            name: name.to_string(),
            email: email.to_string(),
            role: role.to_string(),
            exp: expiry,
        };

        encode(
            &JwtHeader::default(),
            &claims,
            &EncodingKey::from_secret(jwt_secret.as_ref()),
        )
        .map_err(|e| ApiError::internal_error(format!("JWT 토큰 생성 실패: {}", e)))
    }

    pub fn create_auth_cookies(jwt_token: &str, frontend_url: &str) -> Vec<HeaderValue> {
        let mut cookies = Vec::new();

        // JWT 토큰 쿠키
        let jwt_cookie = format!(
            "jwt={}; HttpOnly; Secure; SameSite=None; Path=/; Domain={}; Max-Age={}",
            jwt_token,
            if frontend_url.contains("localhost") { "localhost" } else { ".young-buddha.online" },
            JWT_EXPIRY_SECONDS
        );
        cookies.push(HeaderValue::from_str(&jwt_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // 인증 상태 쿠키
        let auth_cookie = format!(
            "is_authenticated=true; HttpOnly; Secure; SameSite=None; Path=/; Domain={}; Max-Age={}",
            if frontend_url.contains("localhost") { "localhost" } else { ".young-buddha.online" },
            JWT_EXPIRY_SECONDS
        );
        cookies.push(HeaderValue::from_str(&auth_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        cookies
    }

    pub async fn handle_google_callback(
        state: Arc<AppState>,
        query: CallbackQuery,
        headers: HeaderMap,
    ) -> Result<(Vec<HeaderValue>, serde_json::Value), ApiError> {
        tracing::info!("OAuth callback received: code={:?}, state={:?}", query.code.is_some(), query.state);

        // 모든 쿠키 로그
        if let Some(cookie_header) = headers.get("cookie") {
            if let Ok(cookie_str) = cookie_header.to_str() {
                tracing::info!("Received cookies: {}", cookie_str);
            }
        } else {
            tracing::warn!("No cookies received in callback");
        }

        // validate query
        let code = query.code.ok_or_else(|| {
            tracing::error!("Missing authorization code in callback");
            ApiError::bad_request("MISSING_CODE", "Missing code")
        })?;

        let state_query = query.state.ok_or_else(|| {
            tracing::error!("Missing state parameter in callback");
            ApiError::bad_request("MISSING_STATE", "Missing state")
        })?;

        // verify oauth_state from memory store
        if !Self::verify_oauth_state(&state_query) {
            tracing::error!("Invalid or expired oauth state: {}", state_query);
            return Err(ApiError::bad_request("INVALID_STATE", "Invalid or expired oauth state"));
        }

        // Get OAuth configuration from app state
        let client_id = state.config.get_google_client_id()
            .map_err(|e| ApiError::internal_error(e))?;
        let client_secret = state.config.get_google_client_secret()
            .map_err(|e| ApiError::internal_error(e))?;
        let redirect_uri = state.config.get_google_redirect_uri()
            .map_err(|e| ApiError::internal_error(e))?;

        // exchange code for tokens
        let form = [
            ("code", code.as_str()),
            ("client_id", client_id.as_str()),
            ("client_secret", client_secret.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];

        let token_resp = state.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&form)
            .send()
            .await
            .map_err(|e| ApiError::bad_gateway("OAUTH_FAILED", format!("OAuth 토큰 교환 실패: {}", e)))?;

        if !token_resp.status().is_success() {
            let error_text = token_resp.text().await.unwrap_or_default();
            tracing::error!("OAuth token exchange failed: {}", error_text);
            return Err(ApiError::bad_gateway("OAUTH_FAILED", "OAuth 토큰 교환 실패"));
        }

        let token_data: TokenResponse = token_resp.json().await
            .map_err(|e| ApiError::internal_error(format!("토큰 응답 파싱 실패: {}", e)))?;

        // get user info
        let user_resp = state.http_client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(&token_data.access_token)
            .send()
            .await
            .map_err(|e| ApiError::bad_gateway("USER_INFO_FAILED", format!("사용자 정보 조회 실패: {}", e)))?;

        if !user_resp.status().is_success() {
            let error_text = user_resp.text().await.unwrap_or_default();
            tracing::error!("User info fetch failed: {}", error_text);
            return Err(ApiError::bad_gateway("USER_INFO_FAILED", "사용자 정보 조회 실패"));
        }

        let user_info: GoogleUserInfo = user_resp.json().await
            .map_err(|e| ApiError::internal_error(format!("사용자 정보 파싱 실패: {}", e)))?;

        let email = user_info.email.unwrap_or_else(|| "unknown@example.com".to_string());
        let name = user_info.name.unwrap_or_else(|| "Unknown User".to_string());

        // Persist Google tokens for this user (UPSERT)
        // Calculate absolute expiry timestamp
        let expires_in = token_data.expires_in.unwrap_or(3600);
        let expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;

        let access_token_to_save = token_data.access_token.clone();
        let refresh_token_to_save = token_data.refresh_token.clone();
        let email_for_save = email.clone();
        let db_path_for_save = state.db_path.clone();

        // Run blocking SQLite write in blocking thread
        let _ = tokio::task::spawn_blocking(move || {
            if let Ok(db) = rusqlite::Connection::open(&db_path_for_save) {
                // Create table if not exists (defensive in case init didn't run yet)
                let _ = db.execute_batch(
                    r#"
                    CREATE TABLE IF NOT EXISTS user_tokens (
                        email TEXT PRIMARY KEY,
                        access_token TEXT NOT NULL,
                        refresh_token TEXT,
                        expires_at INTEGER NOT NULL
                    );
                    "#,
                );

                // Use INSERT OR REPLACE to upsert tokens
                let _ = db.execute(
                    "INSERT INTO user_tokens (email, access_token, refresh_token, expires_at) VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(email) DO UPDATE SET
                        access_token = excluded.access_token,
                        refresh_token = COALESCE(excluded.refresh_token, user_tokens.refresh_token),
                        expires_at = excluded.expires_at",
                    rusqlite::params![
                        email_for_save,
                        access_token_to_save,
                        refresh_token_to_save,
                        expires_at
                    ],
                );
            }
        }).await;

        // create JWT token
        let jwt_secret = state.jwt_secret.as_ref()
            .ok_or_else(|| ApiError::internal_error("JWT_SECRET not configured"))?;

        let jwt_token = Self::create_jwt_token(&name, &email, "user", jwt_secret)?;

        // create cookies
        let cookies = Self::create_auth_cookies(&jwt_token, &state.frontend_url);

        let response_data = json!({
            "success": true,
            "user": {
                "name": name,
                "email": email
            }
        });

        Ok((cookies, response_data))
    }

    pub async fn get_current_user(
        state: Arc<AppState>,
        headers: HeaderMap,
    ) -> Result<serde_json::Value, ApiError> {
        let email = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref())
            .ok_or_else(|| ApiError::unauthorized("로그인이 필요합니다."))?;

        Ok(json!({
            "authenticated": true,
            "email": email
        }))
    }

    pub fn logout(frontend_url: &str) -> Vec<HeaderValue> {
        let mut cookies = Vec::new();

        // JWT 토큰 쿠키 삭제
        let jwt_cookie = format!(
            "jwt=; HttpOnly; Secure; SameSite=None; Path=/; Domain={}; Max-Age=0",
            if frontend_url.contains("localhost") { "localhost" } else { ".young-buddha.online" }
        );
        cookies.push(HeaderValue::from_str(&jwt_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // 인증 상태 쿠키 삭제
        let auth_cookie = format!(
            "is_authenticated=; HttpOnly; Secure; SameSite=None; Path=/; Domain={}; Max-Age=0",
            if frontend_url.contains("localhost") { "localhost" } else { ".young-buddha.online" }
        );
        cookies.push(HeaderValue::from_str(&auth_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        cookies
    }
}
