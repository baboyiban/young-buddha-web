mod routes;
mod auth;
mod auth_tokens;
mod state;
mod types;
mod config;
mod api;

use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // env
    let _ = dotenvy::dotenv();

    // app state
    let app_state = state::AppState::from_env();
    let _config = config::AppConfig::from_env();

    // Validate required secrets in production; fail fast to avoid running with broken security
    if app_state.is_production && app_state.jwt_secret.is_none() {
        tracing::error!("JWT_SECRET is not set but NODE_ENV=production — refusing to start");
        std::process::exit(1);
    } else if app_state.jwt_secret.is_none() {
        tracing::warn!("JWT_SECRET is not set — auth endpoints will not work (acceptable for local development)");
    }

    // initialize global redis client if present in app state (avoid per-request Client::open)
    if let Some(rc) = &app_state.redis_client {
        crate::auth::redis_cache::init_global_redis(rc.clone());
        tracing::info!("Initialized global Redis client from REDIS_URL");
    }

    // router (use existing routes module for now)
    let app = routes::build_router(app_state.clone())
        .with_state(app_state);

    let port = std::env::var("PORT").ok().and_then(|v| v.parse::<u16>().ok()).unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!(%addr, "starting server");
    // quick sanity logs for OAuth config
    if let Ok(id) = std::env::var("GOOGLE_CLIENT_ID") {
        tracing::info!(client_id = %id, "GOOGLE_CLIENT_ID loaded");
    } else {
        tracing::warn!("GOOGLE_CLIENT_ID not set");
    }
    if let Ok(uri) = std::env::var("GOOGLE_REDIRECT_URI") {
        tracing::info!(redirect_uri = %uri, "GOOGLE_REDIRECT_URI loaded");
    } else {
        tracing::warn!("GOOGLE_REDIRECT_URI not set");
    }
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
