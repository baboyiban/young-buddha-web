pub mod auth;
pub mod database;
pub mod google_service_account;
pub mod sheets;

use std::sync::Arc;
use reqwest::Client;
use crate::config::Config;
use crate::db::DatabasePool;
use crate::cache::{CacheProvider, RedisCache};
use crate::types::error::AppError;

pub struct AppServices {
  pub auth: auth::AuthService,
  pub database: database::DatabaseService,
  pub sheets: sheets::SheetsService,
  pub google_service_account: google_service_account::GoogleServiceAccountAuth,
}

impl AppServices {
    pub async fn new(config: Config) -> Result<Arc<Self>, AppError> {
        let config = Arc::new(config);
        let http_client = Client::new();

        tracing::info!("Initializing DatabasePool at path: {}", config.database.path);
        // 데이터베이스 풀 초기화
        let db_pool = Arc::new(DatabasePool::new(config.database.path.clone())?);
        tracing::info!("DatabasePool initialized");

        // 캐시 초기화 (옵션)
        let cache: Option<Arc<dyn CacheProvider>> = if let Some(redis_url) = &config.cache.redis_url {
            match RedisCache::new(redis_url.clone(), config.cache.default_ttl) {
                Ok(redis_cache) => {
                    tracing::info!("Redis cache initialized (url: {})", redis_url);
                    Some(Arc::new(redis_cache))
                },
                Err(e) => {
                    tracing::warn!("Failed to initialize Redis cache: {}", e);
                    None
                }
            }
        } else {
            tracing::info!("No Redis configured");
            None
        };

        tracing::info!("Initializing AuthService");
        // 서비스들 초기화
        let auth = auth::AuthService::new(
            config.clone(),
            http_client.clone(),
            db_pool.clone(),
            cache.clone(),
        );
        tracing::info!("AuthService initialized");

        tracing::info!("Initializing DatabaseService");
        let database = database::DatabaseService::new(db_pool.clone());
        tracing::info!("DatabaseService initialized");

        tracing::info!("Initializing SheetsService");
        let sheets = sheets::SheetsService::new(
            config.clone(),
            http_client.clone(),
            cache.clone(),
        );
        tracing::info!("SheetsService initialized");

        let sa_path = config.google.service_account_key_path.clone().unwrap_or_default();
        tracing::info!("Google service account key configured: {}", !sa_path.is_empty());
        // 서비스 계정은 Clone 제거하고 단순 초기화
        let google_service_account = google_service_account::GoogleServiceAccountAuth::new(sa_path);

        Ok(Arc::new(Self {
            auth,
            database,
            sheets,
            google_service_account,
        }))
    }
}
