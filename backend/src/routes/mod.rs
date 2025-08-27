pub mod auth;
pub mod sheets;
pub mod database;
pub mod sheets_parser;
pub mod sheets_client;
pub mod health;

use axum::Router;
use crate::types::AppState;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use axum::http::{HeaderValue, Method};
use axum::{middleware, http::{Request, StatusCode}};
use axum::response::Response;
use axum::middleware::Next;

pub fn build_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // CORS 설정
    let origin = state
        .frontend_url
        .parse::<HeaderValue>()
        .unwrap_or_else(|_| HeaderValue::from_static("http://localhost:3000"));
    let cors = CorsLayer::new()
        .allow_origin(origin)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // API v1 라우터
    let api_v1 = Router::new()
        .route("/health", axum::routing::get(health::health))
        .nest("/sheets", sheets::router());

    // 메인 라우터
    Router::new()
        .nest("/auth", auth::router())      // 인증: /auth/*
        .nest("/api/v1", api_v1)            // API: /api/v1/*
        .layer(middleware::from_fn(csrf_protect))
        .layer(cors)                        // CORS 미들웨어 적용
        .with_state(state)
}

// CSRF 보호 미들웨어 (Double Submit Cookie)
async fn csrf_protect(req: Request<axum::body::Body>, next: Next) -> Response {
    // 안전한 메서드는 통과
    let method = req.method().clone();
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return next.run(req).await;
    }

    // 특정 경로는 예외 처리: OAuth 시작은 로그인 전이므로 패스
    let path = req.uri().path();
    if path.starts_with("/auth/google") {
        return next.run(req).await;
    }

    let headers = req.headers();
    let header_token = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    // 쿠키에서 csrf_token 추출
    let cookie_token = headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .and_then(|cookie_str| {
            cookie_str
                .split(';')
                .find_map(|part| {
                    let trimmed = part.trim();
                    if let Some((k, v)) = trimmed.split_once('=') {
                        if k == "csrf_token" { Some(v.to_string()) } else { None }
                    } else { None }
                })
        })
        .unwrap_or_default();

    if !header_token.is_empty() && header_token == cookie_token {
        return next.run(req).await;
    }

    Response::builder()
        .status(StatusCode::FORBIDDEN)
        .body(axum::body::Body::from("CSRF token invalid or missing"))
        .unwrap()
}
