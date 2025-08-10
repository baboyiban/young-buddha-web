mod web;
mod routes;
mod state;

use std::net::SocketAddr;
use axum::Router;
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

    // router
    let app = routes::build_router(app_state.clone())
        .with_state(app_state);

    let port = std::env::var("PORT").ok().and_then(|v| v.parse::<u16>().ok()).unwrap_or(8080);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));

    tracing::info!(%addr, "starting server");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
