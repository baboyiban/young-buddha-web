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
    // CORS 설정 - 환경에 맞는 프론트엔드 Origin만 허용
    let mut allowed_origins: Vec<HeaderValue> = Vec::new();
    if let Ok(origin) = state.config.frontend_url.parse::<HeaderValue>() {
        allowed_origins.push(origin);
    }
    // 개발 편의를 위해 로컬 호스트를 자동 허용 (frontend_url이 localhost인 경우는 중복 제거)
    if !state.config.frontend_url.contains("localhost") {
        if let Ok(local) = "http://localhost:3000".parse::<HeaderValue>() { allowed_origins.push(local); }
    }

    let cors = CorsLayer::new()
        .allow_origin(allowed_origins)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::ACCEPT,
            axum::http::header::AUTHORIZATION,
            axum::http::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true)
        .expose_headers([
            axum::http::header::SET_COOKIE,
            axum::http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
        ]);

    // API 라우터
    let api_router = Router::new()
        .route("/health", axum::routing::get(health::health))
        .nest("/auth", auth::router())      // 인증: /api/auth/*
        .nest("/sheets", sheets::router())  // 시트: /api/sheets/*
        .nest("/database", database::router()); // 데이터베이스: /api/database/*

    // 메인 라우터
    Router::new()
        .nest("/api", api_router)           // 모든 API: /api/*
        .route("/", axum::routing::get(|| async { "Young Buddha Backend is running" }))
        .route("/health", axum::routing::get(health::health)) // 루트 헬스 엔드포인트 추가
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
    if path.starts_with("/api/auth/google") {
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
