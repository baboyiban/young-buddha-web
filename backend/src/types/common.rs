use axum::http::StatusCode;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use reqwest::Client;
use redis;

// ======== Application State ========

#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: Option<String>,
    pub is_production: bool,
    pub db_path: String,
    pub frontend_url: String,
    pub http_client: Client,
    pub redis_client: Option<redis::Client>,
    pub config: crate::config::AppConfig,
}

impl AppState {
    pub fn from_env() -> Arc<Self> {
        let config = crate::config::AppConfig::from_env();
        
        // Validate production configuration
        if let Err(e) = config.validate_production_config() {
            tracing::error!("Configuration validation failed: {}", e);
            std::process::exit(1);
        }

        let jwt_secret = config.jwt_secret.clone();
        let is_production = config.is_production();
        let db_path = config.db_path.clone();
        let frontend_url = config.frontend_url.clone();

        let http_client = Client::new();
        let redis_client = config.redis_url.clone().and_then(|u| redis::Client::open(u).ok());

        Arc::new(Self { 
            jwt_secret, 
            is_production, 
            db_path, 
            frontend_url, 
            http_client, 
            redis_client,
            config,
        })
    }
} 