use axum::{Router, routing::{get, post, delete}, response::{IntoResponse, Response}, Json, extract::State};
use serde::{Deserialize};
use serde_json::json;
use crate::state::AppState;
use std::sync::Arc;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};

pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/auth/google", post(not_implemented))
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
