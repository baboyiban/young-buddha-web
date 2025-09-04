use axum::http::{HeaderValue, Method};
use tower_http::cors::CorsLayer;
use crate::config::Config;

pub fn create_cors_layer(config: &Config) -> CorsLayer {
    let mut allowed_origins: Vec<HeaderValue> = Vec::new();

    if let Ok(origin) = config.server.frontend_url.parse::<HeaderValue>() {
        allowed_origins.push(origin);
    }

    // 개발 환경에서 localhost 허용
    if !config.server.frontend_url.contains("localhost") {
        if let Ok(local) = "http://localhost:3000".parse::<HeaderValue>() {
            allowed_origins.push(local);
        }
    }

    CorsLayer::new()
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
        ])
}
