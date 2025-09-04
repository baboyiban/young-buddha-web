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

        // 데이터베이스 풀 초기화
        let db_pool = Arc::new(DatabasePool::new(config.database.path.clone())?);

        // 캐시 초기화 (옵션)
        let cache: Option<Arc<dyn CacheProvider>> = if let Some(redis_url) = &config.cache.redis_url {
            match RedisCache::new(redis_url.clone(), config.cache.default_ttl) {
                Ok(redis_cache) => {
                    tracing::info!("Redis cache initialized");
                    Some(Arc::new(redis_cache))
                },
                Err(e) => {
                    tracing::warn!("Failed to initialize Redis cache: {}", e);
                    None
                }
            }
        } else {
            None
        };

        // 서비스들 초기화
        let auth = auth::AuthService::new(
            config.clone(),
            http_client.clone(),
            db_pool.clone(),
            cache.clone(),
        );

        let database = database::DatabaseService::new(db_pool.clone());

        let sheets = sheets::SheetsService::new(
            config.clone(),
            http_client.clone(),
            cache.clone(),
        );

        // 서비스 계정은 Clone 제거하고 단순 초기화
        let google_service_account = google_service_account::GoogleServiceAccountAuth::new(
            config.google.service_account_key_path.clone().unwrap_or_default()
        );

        Ok(Arc::new(Self {
            auth,
            database,
            sheets,
            google_service_account,
        }))
    }
}
