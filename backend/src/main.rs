mod routes;
mod auth;
mod auth_tokens;
mod state;
mod types;
mod config;
mod api;
mod db;
mod services;

use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    let _ = dotenvy::dotenv();

    // Initialize app state
    let app_state = state::AppState::from_env();

    // Log configuration status
    if app_state.is_production {
        tracing::info!("Running in production mode");
    } else {
        tracing::info!("Running in development mode");
    }

    if app_state.jwt_secret.is_none() {
        tracing::warn!("JWT_SECRET is not set — auth endpoints will not work (acceptable for local development)");
    }

    // Initialize global Redis client if present
    if let Some(rc) = &app_state.redis_client {
        crate::auth::redis_cache::init_global_redis(rc.clone());
        tracing::info!("Initialized global Redis client from REDIS_URL");
    }

    // Initialize database schema
    tracing::info!(db_path = %app_state.db_path, "initializing database");
    if let Err(e) = crate::db::pool::initialize_db(&app_state.db_path).await {
        tracing::error!(error = %e, "failed to initialize database");
        std::process::exit(1);
    }

    // Get port from configuration
    let port = app_state.config.port;

    // Log OAuth configuration status
    if let Ok(id) = app_state.config.get_google_client_id() {
        tracing::info!(client_id = %id, "GOOGLE_CLIENT_ID loaded");
    } else {
        tracing::warn!("GOOGLE_CLIENT_ID not set");
    }
    
    if let Ok(uri) = app_state.config.get_google_redirect_uri() {
        tracing::info!(redirect_uri = %uri, "GOOGLE_REDIRECT_URI loaded");
    } else {
        tracing::warn!("GOOGLE_REDIRECT_URI not set");
    }

    // Build router
    let app = routes::build_router(app_state.clone())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    // Log startup information
    tracing::info!(%addr, "starting server");

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
