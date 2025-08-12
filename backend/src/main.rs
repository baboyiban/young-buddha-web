mod routes;
mod state;

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
    // Fallback: also try to load env from Zig backend folder if present
    let _ = dotenvy::from_filename("../backend/.env");

    // app state
    let app_state = state::AppState::from_env();

    // router
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
