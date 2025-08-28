#![allow(dead_code)]
use crate::types::{AppState, CallbackQuery, TokenResponse, GoogleUserInfo, JwtClaims, ApiError};
use crate::auth_tokens::get_email_from_jwt_cookie;
use axum::http::{HeaderMap, HeaderValue};
use jsonwebtoken::{encode, EncodingKey, Header as JwtHeader};
use rand::{distributions::Alphanumeric, Rng};
use serde_json::json;
use std::sync::Arc;
use time::OffsetDateTime;

// JWT 토큰 유효 시간 설정 (초 단위)
const JWT_EXPIRY_SECONDS: i64 = 60 * 60 * 24 * 7; // 7일

pub struct AuthService;

impl AuthService {
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

        // 로컬/프로덕션 환경에 따라 쿠키 속성 분기
        let is_localhost = frontend_url.contains("localhost");
        let domain_opt = if is_localhost { None } else { Some("young-buddha.online") };
        let same_site = if is_localhost { "Lax" } else { "None" };
        let secure = if is_localhost { "" } else { "; Secure" };

        // JWT 토큰 쿠키 (로컬 환경에서는 도메인 설정 제거)
        let jwt_cookie = if let Some(domain) = domain_opt {
            format!(
                "jwt={}; HttpOnly{}; SameSite={}; Path=/; Domain={}; Max-Age={}",
                jwt_token,
                secure,
                same_site,
                domain,
                JWT_EXPIRY_SECONDS
            )
        } else {
            format!(
                "jwt={}; HttpOnly{}; SameSite={}; Path=/; Max-Age={}",
                jwt_token,
                secure,
                same_site,
                JWT_EXPIRY_SECONDS
            )
        };
        cookies.push(HeaderValue::from_str(&jwt_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // 인증 상태 쿠키
        let auth_cookie = if let Some(domain) = domain_opt {
            format!(
                "is_authenticated=true; SameSite={}; Path=/; Domain={}; Max-Age={}{}",
                same_site,
                domain,
                JWT_EXPIRY_SECONDS,
                secure
            )
        } else {
            format!(
                "is_authenticated=true; SameSite={}; Path=/; Max-Age={}{}",
                same_site,
                JWT_EXPIRY_SECONDS,
                secure
            )
        };
        cookies.push(HeaderValue::from_str(&auth_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // CSRF 토큰 쿠키 (Double Submit Cookie) - HttpOnly 아님
        let csrf_token: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(48)
            .map(char::from)
            .collect();
        let csrf_cookie = if let Some(domain) = domain_opt {
            format!(
                "csrf_token={}; SameSite={}; Path=/; Domain={}; Max-Age={}{}",
                csrf_token,
                same_site,
                domain,
                JWT_EXPIRY_SECONDS,
                secure
            )
        } else {
            format!(
                "csrf_token={}; SameSite={}; Path=/; Max-Age={}{}",
                csrf_token,
                same_site,
                JWT_EXPIRY_SECONDS,
                secure
            )
        };
        cookies.push(HeaderValue::from_str(&csrf_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        cookies
    }

    pub async fn handle_google_callback(
        state: Arc<AppState>,
        query: CallbackQuery,
        state_from_cookie: Option<String>,
    ) -> Result<(Vec<HeaderValue>, serde_json::Value), ApiError> {
        tracing::info!("OAuth callback received: code={:?}, state={:?}", query.code.is_some(), query.state);

        // validate query
        let code = query.code.ok_or_else(|| {
            tracing::error!("Missing authorization code in callback");
            ApiError::bad_request("MISSING_CODE", "Missing code")
        })?;

        let state_query = query.state.ok_or_else(|| {
            tracing::error!("Missing state parameter in callback");
            ApiError::bad_request("MISSING_STATE", "Missing state")
        })?;

        // verify oauth_state from cookie
        let state_cookie = state_from_cookie.ok_or_else(|| {
            tracing::error!("Missing oauth_state cookie");
            ApiError::bad_request("MISSING_STATE_COOKIE", "Missing state cookie")
        })?;

        if state_cookie != state_query {
            tracing::error!("Mismatched oauth state: cookie='{}', query='{}'", state_cookie, state_query);
            return Err(ApiError::bad_request("INVALID_STATE", "Mismatched oauth state"));
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
        let mut name = user_info.name.unwrap_or_else(|| "Unknown User".to_string());

        // Persist Google tokens for this user (UPSERT)
        let expires_in = token_data.expires_in.unwrap_or(3600);
        let expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;

        let access_token_to_save = token_data.access_token.clone();
        let refresh_token_to_save = token_data.refresh_token.clone();
        let email_for_save = email.clone();
        let db_path_for_save = state.db_path.clone();

        // Run blocking SQLite write in blocking thread
        let _ = tokio::task::spawn_blocking(move || {
            if let Ok(db) = rusqlite::Connection::open(&db_path_for_save) {
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

        // Resolve role/name from user sheet (with cache). Default role is USER.
        let (resolved_name, resolved_role) = Self::resolve_user_profile_from_sheet(state.clone(), &email).await;
        if let Some(n) = resolved_name { name = n; }
        let role_for_jwt = resolved_role.unwrap_or_else(|| "USER".to_string());

        let jwt_token = Self::create_jwt_token(&name, &email, &role_for_jwt, jwt_secret)?;

        // create cookies
        let cookies = Self::create_auth_cookies(&jwt_token, &state.frontend_url);

        let response_data = json!({
            "success": true,
            "user": {
                "name": name,
                "email": email,
                "role": role_for_jwt
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

        let (name_opt, role_opt) = Self::resolve_user_profile_from_sheet(state.clone(), &email).await;
        let name = name_opt.unwrap_or_else(|| email.split('@').next().unwrap_or("user").to_string());
        let role = role_opt.unwrap_or_else(|| "USER".to_string());

        Ok(json!({
            "authenticated": true,
            "email": email,
            "name": name,
            "role": role
        }))
    }

    pub fn logout(frontend_url: &str) -> Vec<HeaderValue> {
        let mut cookies = Vec::new();

        let is_localhost = frontend_url.contains("localhost");
        let domain_opt = if is_localhost { None } else { Some(".young-buddha.online") };
        let same_site = if is_localhost { "Lax" } else { "None" };
        let secure = if is_localhost { "" } else { "; Secure" };

        // JWT 토큰 쿠키 삭제
        let jwt_cookie = if let Some(domain) = domain_opt {
            format!(
                "jwt=; HttpOnly{}; SameSite={}; Path=/; Domain={}; Max-Age=0",
                secure,
                same_site,
                domain
            )
        } else {
            format!(
                "jwt=; HttpOnly{}; SameSite={}; Path=/; Max-Age=0",
                secure,
                same_site
            )
        };
        cookies.push(HeaderValue::from_str(&jwt_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // 인증 상태 쿠키 삭제
        let auth_cookie = if let Some(domain) = domain_opt {
            format!(
                "is_authenticated=; SameSite={}; Path=/; Domain={}; Max-Age=0{}",
                same_site,
                domain,
                secure
            )
        } else {
            format!(
                "is_authenticated=; SameSite={}; Path=/; Max-Age=0{}",
                same_site,
                secure
            )
        };
        cookies.push(HeaderValue::from_str(&auth_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // CSRF 토큰 쿠키 삭제
        let csrf_cookie = if let Some(domain) = domain_opt {
            format!(
                "csrf_token=; SameSite={}; Path=/; Domain={}; Max-Age=0{}",
                same_site,
                domain,
                secure
            )
        } else {
            format!(
                "csrf_token=; SameSite={}; Path=/; Max-Age=0{}",
                same_site,
                secure
            )
        };
        cookies.push(HeaderValue::from_str(&csrf_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        cookies
    }
}

impl AuthService {
    async fn resolve_user_profile_from_sheet(state: Arc<AppState>, email: &str) -> (Option<String>, Option<String>) {
        if let Some((cached_name, cached_role)) = crate::auth::redis_cache::get_cached_user_profile(email).await {
            return (Some(cached_name), Some(cached_role));
        }

        let spreadsheet_id = match state.config.get_user_sheet_spreadsheet_id() {
            Ok(v) => v,
            Err(_) => return (None, None),
        };
        let sheet_name = match state.config.get_user_sheet_name() {
            Ok(v) => v,
            Err(_) => return (None, None),
        };

        let query = format!("SELECT B,C WHERE A = '{}'", email.replace("'", "''"));
        let url = format!(
            "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
            spreadsheet_id,
            urlencoding::encode(&query),
            urlencoding::encode(&sheet_name)
        );

        let client = &state.http_client;
        let maybe_access = crate::auth_tokens::get_valid_user_token(client, &state.db_path, email).await;
        let req = client.get(&url);
        let req = if let Some(token) = maybe_access.clone() { req.bearer_auth(token) } else { req };
        let resp = match req.send().await {
            Ok(r) => r,
            Err(_) => return (None, None),
        };
        if !resp.status().is_success() {
            return (None, None);
        }
        let text = match resp.text().await { Ok(t) => t, Err(_) => return (None, None) };
        let parsed: serde_json::Value = match crate::routes::sheets_parser::parse_gviz_json(&text) { Ok(v) => v, Err(_) => return (None, None) };
        let rows = parsed.get("table").and_then(|t| t.get("rows")).and_then(|r| r.as_array());
        if let Some(rows) = rows {
            if let Some(row0) = rows.get(0) {
                let cells = row0.get("c").and_then(|c| c.as_array());
                if let Some(cells) = cells {
                    let name = cells.get(0).and_then(|c| c.get("v")).and_then(|v| v.as_str()).map(|s| s.to_string());
                    let role = cells.get(1).and_then(|c| c.get("v")).and_then(|v| v.as_str()).map(|s| s.to_string());
                    if let (Some(ref n), Some(ref r)) = (&name, &role) {
                        let _ = crate::auth::redis_cache::store_user_profile(email, n, r, 1800).await;
                    }
                    return (name, role);
                }
            }
        }
        (None, None)
    }
}