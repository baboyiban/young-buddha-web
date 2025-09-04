use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use young_buddha_backend::{config::Config, services::AppServices, routes::build_router};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load environment variables
    let _ = dotenvy::dotenv();

    // Load configuration
    let config = Config::from_env()?;
    tracing::info!("Loaded configuration for environment: {:?}", config.server.environment);

    // Initialize services
    let services = AppServices::new(config.clone()).await?;
    tracing::info!("Initialized application services");

    // Build router
    let app = build_router(services);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));

    tracing::info!(%addr, "Starting server");

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
