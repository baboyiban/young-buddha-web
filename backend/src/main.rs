use std::net::SocketAddr;
use std::process;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use young_buddha_backend::{config::Config, services::AppServices, routes::build_router};

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Ensure panics are logged
    std::panic::set_hook(Box::new(|panic_info| {
        tracing::error!("Unhandled panic: {:?}", panic_info);
    }));

    // Load .env if present
    let _ = dotenvy::dotenv();

    // Load configuration
    let config = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!("Failed to load configuration: {:?}", e);
            process::exit(1);
        }
    };
    tracing::info!("Loaded configuration for environment: {:?}", config.server.environment);

    // Initialize services
    let services = match AppServices::new(config.clone()).await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("Failed to initialize application services: {:?}", e);
            process::exit(1);
        }
    };
    tracing::info!("Initialized application services");

    // Build router and bind
    let app = build_router(services);
    let addr = SocketAddr::from(([0, 0, 0, 0], config.server.port));
    tracing::info!(%addr, "Starting server");

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            tracing::error!("Failed to bind listener: {}", e);
            process::exit(1);
        }
    };

    if let Err(e) = axum::serve(listener, app).await {
        tracing::error!("Server exited with error: {:?}", e);
        process::exit(1);
    }
}
