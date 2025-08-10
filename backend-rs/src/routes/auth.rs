use axum::{Router, routing::{get, post, delete}, response::{IntoResponse, Response}, Json, extract::State};
use serde::{Deserialize};
use serde_json::json;
use crate::state::AppState;
use std::sync::Arc;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use rand::{distributions::Alphanumeric, Rng};
use axum::http::{HeaderMap, HeaderValue, header::SET_COOKIE};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/auth/google", post(google_auth))
        .route("/auth/google", get(google_auth_get))
        .route("/auth/google/callback", get(not_implemented))
        .route("/auth/me", get(me))
        .route("/auth/logout", delete(logout))
}

async fn not_implemented() -> Response {
    (
        axum::http::StatusCode::NOT_IMPLEMENTED,
        Json(json!({"error":true,"message":"Not implemented yet (Rust port)"})),
    ).into_response()
}

async fn google_auth(State(state): State<Arc<AppState>>) -> Response {
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

    // set oauth_state cookie (HttpOnly, short max-age)
    let cookie = format!(
        "oauth_state={}; Max-Age={}; Path=/; HttpOnly{}",
        state_val,
        300,
        if state.is_production { "; Secure" } else { "" }
    );

    // build auth url
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        auth_base,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&state_val)
    );

    let mut headers = HeaderMap::new();
    if let Ok(val) = HeaderValue::from_str(&cookie) {
        headers.insert(SET_COOKIE, val);
    }

    (
        axum::http::StatusCode::OK,
        headers,
        Json(json!({"auth_url": auth_url})),
    ).into_response()
}

async fn google_auth_get(State(state): State<Arc<AppState>>) -> Response {
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

    let cookie = format!(
        "oauth_state={}; Max-Age={}; Path=/; HttpOnly{}",
        state_val,
        300,
        if state.is_production { "; Secure" } else { "" }
    );

    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&prompt=consent",
        auth_base,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scope),
        urlencoding::encode(&state_val)
    );

    let mut headers = HeaderMap::new();
    if let Ok(val) = HeaderValue::from_str(&cookie) {
        headers.insert(SET_COOKIE, val);
    }
    headers.insert(axum::http::header::LOCATION, HeaderValue::from_str(&auth_url).unwrap());

    (
        axum::http::StatusCode::FOUND,
        headers,
    ).into_response()
}

#[derive(Debug, Deserialize)]
struct Claims {
    sub: Option<String>,
    name: Option<String>,
    email: Option<String>,
    role: Option<String>,
    exp: Option<i64>,
    access_token: Option<String>,
    refresh_token: Option<String>,
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
            let name = data.claims.name.unwrap_or_default();
            let email = data.claims.email.unwrap_or_default();
            let role = data.claims.role.unwrap_or_default();
            (
                axum::http::StatusCode::OK,
                Json(json!({"name":name,"email":email,"role":role})),
            )
        }
        Err(err) => {
            let (status, code, message) = match err.kind() {
                jsonwebtoken::errors::ErrorKind::ExpiredSignature => (
                    axum::http::StatusCode::UNAUTHORIZED,
                    "TOKEN_EXPIRED",
                    "Token expired",
                ),
                _ => (
                    axum::http::StatusCode::UNAUTHORIZED,
                    "INVALID_TOKEN",
                    "Invalid token",
                ),
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
    // Zig: name=jwt; Max-Age=0; Path=/; HttpOnly; Secure(if production)
    format!(
        "jwt=; Max-Age=0; Path=/; HttpOnly{}",
        if secure { "; Secure" } else { "" }
    )
}
