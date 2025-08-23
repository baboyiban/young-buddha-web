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
            axum::http::header::AUTHORIZATION,
            axum::http::header::ACCEPT,
        ])
        .allow_credentials(true);

    // API v1 라우터
    let api_v1 = Router::new()
        .route("/health", axum::routing::get(health::health))
        .nest("/sheets", sheets::router())
        .nest("/database", database::router());

    // 메인 라우터
    Router::new()
        .nest("/auth", auth::router())      // 인증: /auth/*
        .nest("/api/v1", api_v1)            // API: /api/v1/*
        .layer(cors)                        // CORS 미들웨어 적용
}
