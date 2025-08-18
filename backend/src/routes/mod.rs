pub mod auth;
pub mod sheets;
pub mod database;

use axum::Router;
use crate::state::AppState;
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

    // Build API router with the same state type
    let api: Router<Arc<AppState>> = Router::new()
        .merge(auth::router())
        .merge(sheets::router())
        .merge(database::router())
        .layer(cors);

    Router::new()
        .nest("/api", api)
}
