pub mod auth;
pub mod sheets;
pub mod database;
pub mod health;

use std::sync::Arc;
use axum::Router;
use crate::services::AppServices;
use crate::middleware::{create_cors_layer, csrf_protect};

pub fn build_router(services: Arc<AppServices>) -> Router {
    // CORS 레이어 생성
    let cors = create_cors_layer(&services.auth.config);

    // API 라우터
    let api_router = Router::new()
        .route("/health", axum::routing::get(health::health))
        .nest("/auth", auth::router())
        .nest("/sheets", sheets::router())
        .nest("/database", database::router());

    // 메인 라우터
    Router::new()
        .nest("/api", api_router)
        .route("/", axum::routing::get(|| async { "Young Buddha Backend is running" }))
        .route("/health", axum::routing::get(health::health))
        .layer(axum::middleware::from_fn(csrf_protect))
        .layer(cors)
        .with_state(services)
}
