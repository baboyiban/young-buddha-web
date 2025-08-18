use axum::{Router, routing::{get, post, delete}, response::{IntoResponse, Response}, Json, extract::State};
use serde::{Deserialize};
use serde_json::json;
use crate::state::AppState;
use std::sync::Arc;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use rand::{distributions::Alphanumeric, Rng};
use axum::http::{HeaderMap, HeaderValue, header::SET_COOKIE};
use jsonwebtoken::{encode, EncodingKey, Header as JwtHeader};
use axum::extract::Query;
use time::OffsetDateTime;
use std::collections::HashMap;
use std::sync::Mutex;
use once_cell::sync::Lazy;

// JWT 토큰 유효 시간 설정 (초 단위)
const JWT_EXPIRY_SECONDS: i64 = 60 * 60 * 24 * 7; // 7일
const OAUTH_STATE_EXPIRY_SECONDS: i64 = 600; // 10분

// OAuth state 임시 저장소 (메모리)
static OAUTH_STATES: Lazy<Mutex<HashMap<String, i64>>> = Lazy::new(|| Mutex::new(HashMap::new()));

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/auth/google", post(google_auth))
        .route("/auth/google", get(google_auth_get))
        .route("/auth/google/callback", get(google_callback))
        .route("/auth/me", get(me))
        .route("/auth/logout", delete(logout))
}

// OAuth state 관리 함수들
fn store_oauth_state(state: &str) {
    let expiry = OffsetDateTime::now_utc().unix_timestamp() + OAUTH_STATE_EXPIRY_SECONDS;
    if let Ok(mut states) = OAUTH_STATES.lock() {
        states.insert(state.to_string(), expiry);
        // 만료된 state들 정리
        let now = OffsetDateTime::now_utc().unix_timestamp();
        states.retain(|_, &mut exp| exp > now);
    }
}

fn verify_oauth_state(state: &str) -> bool {
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

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    #[allow(dead_code)]
    token_type: Option<String>,
    expires_in: Option<i64>,
    refresh_token: Option<String>,
    #[allow(dead_code)]
    id_token: Option<String>,
}

#[derive(Deserialize)]
struct GoogleUserInfo {
    email: Option<String>,
    name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct JwtClaims {
    name: String,
    email: String,
    role: String,
    exp: i64,
}

async fn google_callback(State(state): State<Arc<AppState>>, Query(q): Query<CallbackQuery>, headers: axum::http::HeaderMap) -> Response {
    tracing::info!("OAuth callback received: code={:?}, state={:?}", q.code.is_some(), q.state);
    
    // 모든 쿠키 로그
    if let Some(cookie_header) = headers.get("cookie") {
        if let Ok(cookie_str) = cookie_header.to_str() {
            tracing::info!("Received cookies: {}", cookie_str);
        }
    } else {
        tracing::warn!("No cookies received in callback");
    }
    
    // validate query
    let Some(code) = q.code.clone() else {
        tracing::error!("Missing authorization code in callback");
        return (axum::http::StatusCode::BAD_REQUEST, Json(json!({"error":true,"message":"Missing code"}))).into_response();
    };
    let Some(state_query) = q.state.clone() else {
        tracing::error!("Missing state parameter in callback");
        return (axum::http::StatusCode::BAD_REQUEST, Json(json!({"error":true,"message":"Missing state"}))).into_response();
    };
    // verify oauth_state from memory store
    if !verify_oauth_state(&state_query) {
        tracing::error!("Invalid or expired oauth state: {}", state_query);
        return (axum::http::StatusCode::BAD_REQUEST, Json(json!({"error":true,"message":"Invalid or expired oauth state"}))).into_response();
    }

    // env
    let client_id = match std::env::var("GOOGLE_CLIENT_ID") { Ok(v) => v, Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"Missing GOOGLE_CLIENT_ID"}))).into_response() };
    let client_secret = match std::env::var("GOOGLE_CLIENT_SECRET") { Ok(v) => v, Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"Missing GOOGLE_CLIENT_SECRET"}))).into_response() };
    let redirect_uri = match std::env::var("GOOGLE_REDIRECT_URI") { Ok(v) => v, Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"Missing GOOGLE_REDIRECT_URI"}))).into_response() };

    // exchange code for tokens
    let form = [
        ("code", code.as_str()),
        ("client_id", client_id.as_str()),
        ("client_secret", client_secret.as_str()),
        ("redirect_uri", redirect_uri.as_str()),
        ("grant_type", "authorization_code"),
    ];
    let token_resp = match reqwest::Client::new()
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":format!("Token request failed: {}", e)}))).into_response(),
    };
    if !token_resp.status().is_success() {
        let status = token_resp.status();
        let body = token_resp.text().await.unwrap_or_default();
        return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":"Token exchange failed","status":status.as_u16(),"body":body}))).into_response();
    }
    let token_json: TokenResponse = match token_resp.json().await { Ok(j) => j, Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":format!("Token parse failed: {}", e)}))).into_response() };

    // fetch user info
    let user_resp = match reqwest::Client::new()
        .get("https://www.googleapis.com/oauth2/v1/userinfo?alt=json")
        .bearer_auth(&token_json.access_token)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":format!("Userinfo request failed: {}", e)}))).into_response(),
    };
    if !user_resp.status().is_success() {
        let status = user_resp.status();
        let body = user_resp.text().await.unwrap_or_default();
        return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":"Userinfo failed","status":status.as_u16(),"body":body}))).into_response();
    }
    let user: GoogleUserInfo = match user_resp.json().await { Ok(u) => u, Err(e) => return (axum::http::StatusCode::BAD_GATEWAY, Json(json!({"error":true,"message":format!("Userinfo parse failed: {}", e)}))).into_response() };

    // persist tokens by email for Sheets API on-behalf-of access
    let email_for_token = user.email.clone().unwrap_or_default();
    if !email_for_token.is_empty() {
        let expires_in = token_json.expires_in.unwrap_or(3600);
        let expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;
        let db = rusqlite::Connection::open(&state.db_path).map_err(|e| e.to_string());
        if let Ok(db) = db {
            let _ = db.execute(
                "INSERT INTO user_tokens(email, access_token, refresh_token, expires_at) VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(email) DO UPDATE SET access_token=excluded.access_token, refresh_token=COALESCE(excluded.refresh_token, user_tokens.refresh_token), expires_at=excluded.expires_at",
                rusqlite::params![email_for_token, token_json.access_token, token_json.refresh_token, expires_at],
            );
        }
    }

    // build JWT
    let Some(secret) = state.jwt_secret.as_deref() else {
        return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"JWT secret not configured"}))).into_response();
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let exp = now + JWT_EXPIRY_SECONDS;
    tracing::info!("Creating JWT: now={}, exp={}, expires_in={}s", now, exp, JWT_EXPIRY_SECONDS);
    let claims = JwtClaims {
        name: user.name.unwrap_or_else(|| "".into()),
        email: user.email.unwrap_or_else(|| "".into()),
        role: "user".into(),
        exp,
    };
    let jwt = match encode(&JwtHeader::default(), &claims, &EncodingKey::from_secret(secret.as_bytes())) {
        Ok(t) => t,
        Err(e) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":format!("JWT encode failed: {}", e)}))).into_response(),
    };

    // set jwt cookie
    let cookie = format!(
        "jwt={}; Max-Age={}; Path=/; HttpOnly; SameSite=Strict{}",
        jwt,
        JWT_EXPIRY_SECONDS,
        if state.is_production { "; Secure" } else { "" }
    );
    let mut out_headers = HeaderMap::new();
    out_headers.insert(SET_COOKIE, HeaderValue::from_str(&cookie).unwrap());
    // redirect back to frontend app
    out_headers.insert(axum::http::header::LOCATION, HeaderValue::from_str(&state.frontend_url).unwrap());
    (axum::http::StatusCode::FOUND, out_headers).into_response()
}

async fn google_auth(State(_state): State<Arc<AppState>>) -> Response {
    let client_id = match std::env::var("GOOGLE_CLIENT_ID") {
        Ok(v) => v,
        Err(_) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":true,"code":"MISSING_GOOGLE_CLIENT_ID","message":"Google Client ID is not configured"}))
            ).into_response();
        },
    };
    let redirect_uri = match std::env::var("GOOGLE_REDIRECT_URI") {
        Ok(v) => v,
        Err(_) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":true,"code":"MISSING_REDIRECT_URI","message":"Redirect URI is not configured"}))
            ).into_response();
        },
    };
    let scope = std::env::var("GOOGLE_SCOPE").unwrap_or_else(|_| "openid email profile https://www.googleapis.com/auth/spreadsheets".into());
    let auth_base = "https://accounts.google.com/o/oauth2/v2/auth";

    tracing::info!(client_id = %client_id, redirect_uri = %redirect_uri, scope = %scope, "Google OAuth config");

    // generate state
    let state_val: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    // store oauth_state in memory instead of cookie
    store_oauth_state(&state_val);
    tracing::info!("Generated OAuth state: {}", state_val);

    // build auth url
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        auth_base,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&state_val)
    );

    (
        axum::http::StatusCode::OK,
        Json(json!({"auth_url": auth_url})),
    ).into_response()
}

async fn google_auth_get(State(_state): State<Arc<AppState>>) -> Response {
    let client_id = match std::env::var("GOOGLE_CLIENT_ID") {
        Ok(v) => v,
        Err(_) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":true,"code":"MISSING_GOOGLE_CLIENT_ID","message":"Google Client ID is not configured"}))
            ).into_response();
        },
    };
    let redirect_uri = match std::env::var("GOOGLE_REDIRECT_URI") {
        Ok(v) => v,
        Err(_) => {
            return (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error":true,"code":"MISSING_REDIRECT_URI","message":"Redirect URI is not configured"}))
            ).into_response();
        },
    };
    let scope = std::env::var("GOOGLE_SCOPE").unwrap_or_else(|_| "openid email profile https://www.googleapis.com/auth/spreadsheets".into());
    let auth_base = "https://accounts.google.com/o/oauth2/v2/auth";

    tracing::info!(client_id = %client_id, redirect_uri = %redirect_uri, scope = %scope, "Google OAuth config");

    let state_val: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    // store oauth_state in memory instead of cookie
    store_oauth_state(&state_val);
    tracing::info!("Generated OAuth state: {}", state_val);

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        auth_base,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&state_val)
    );

    let mut headers = HeaderMap::new();
    headers.insert(axum::http::header::LOCATION, HeaderValue::from_str(&auth_url).unwrap());

    (
        axum::http::StatusCode::FOUND,
        headers,
    ).into_response()
}

#[derive(Debug, Deserialize)]
struct Claims {
    #[allow(dead_code)] sub: Option<String>,
    name: Option<String>,
    email: Option<String>,
    role: Option<String>,
    #[allow(dead_code)] exp: Option<i64>,
    #[allow(dead_code)] access_token: Option<String>,
    #[allow(dead_code)] refresh_token: Option<String>,
}

async fn me(State(state): State<Arc<AppState>>, headers: axum::http::HeaderMap) -> impl IntoResponse {
    let Some(secret) = state.jwt_secret.as_deref() else {
        return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":"JWT secret not configured","code":"INTERNAL_ERROR"})),
        );
    };

    let Some(token) = get_cookie(&headers, "jwt") else {
        return (
            axum::http::StatusCode::UNAUTHORIZED,
            Json(json!({"error":true,"message":"Not logged in","code":"NO_TOKEN"})),
        );
    };

    match decode::<Claims>(
        &token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::new(Algorithm::HS256),
    ) {
        Ok(data) => {
            let now = OffsetDateTime::now_utc().unix_timestamp();
            tracing::info!("JWT validation successful for user: {:?}, current_time={}, token_exp={:?}", 
                data.claims.email, now, data.claims.exp);
            let name = data.claims.name.unwrap_or_default();
            let email = data.claims.email.unwrap_or_default();
            let role = data.claims.role.unwrap_or_default();
            (
                axum::http::StatusCode::OK,
                Json(json!({"name":name,"email":email,"role":role})),
            )
        }
        Err(err) => {
            let now = OffsetDateTime::now_utc().unix_timestamp();
            let (status, code, message) = match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => {
                    tracing::warn!("JWT token expired at current_time={}", now);
                    (
                        axum::http::StatusCode::UNAUTHORIZED,
                        "TOKEN_EXPIRED",
                        "Token expired",
                    )
                },
                _ => {
                    tracing::warn!("JWT validation failed: {:?} at current_time={}", err.kind(), now);
                    (
                        axum::http::StatusCode::UNAUTHORIZED,
                        "INVALID_TOKEN",
                        "Invalid token",
                    )
                },
            };
            (status, Json(json!({"error":true,"message":message,"code":code})))
        }
    }
}

async fn logout(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cookie = build_clear_cookie(state.is_production);
    (
        axum::http::StatusCode::OK,
        [(axum::http::header::SET_COOKIE, cookie)],
        Json(json!({"success":true})),
    )
}

fn get_cookie(headers: &axum::http::HeaderMap, name: &str) -> Option<String> {
    let header_val = headers.get(axum::http::header::COOKIE)?;
    let s = header_val.to_str().ok()?;
    for part in s.split(';') {
        let trimmed = part.trim();
        if let Some((k, v)) = trimmed.split_once('=') {
            if k == name {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn build_clear_cookie(secure: bool) -> String {
    format!(
        "jwt=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict{}",
        if secure { "; Secure" } else { "" }
    )
}
