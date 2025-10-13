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
use crate::utils::logging::ServiceInitializer;

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

        // 구조화된 서비스 초기화 로깅을 사용하여 데이터베이스 풀 초기화
        let db_init = ServiceInitializer::new("DatabasePool");
        let db_pool = match DatabasePool::new(&config.database.path) {
            Ok(pool) => {
                db_init.success(None);
                Arc::new(pool)
            }
            Err(e) => {
                db_init.failed(&e.to_string());
                return Err(e.into());
            }
        };

        // 캐시 초기화 (옵션) - 구조화된 로깅 사용
        let cache: Option<Arc<dyn CacheProvider>> = if let Some(redis_url) = &config.cache.redis_url {
            let cache_init = ServiceInitializer::new("RedisCache");
            match RedisCache::new(redis_url.clone(), config.cache.default_ttl) {
                Ok(redis_cache) => {
                    cache_init.success(Some(format!("url={}", redis_url)));
                    Some(Arc::new(redis_cache))
                },
                Err(e) => {
                    cache_init.failed(&e.to_string());
                    None
                }
            }
        } else {
            // 로그를 구조화하여 Redis가 구성되지 않았음을 명시
            ServiceInitializer::new("RedisCache").skipped("No Redis configured");
            None
        };

        // AuthService 초기화 - 구조화된 로깅 사용
        let auth_init = ServiceInitializer::new("AuthService");
        // 서비스들 초기화
        let auth = auth::AuthService::new(
            config.clone(),
            http_client.clone(),
            db_pool.clone(),
            cache.clone(),
        );
        auth_init.success(None);

        // DatabaseService 초기화 - 구조화된 로깅 사용
        let db_service_init = ServiceInitializer::new("DatabaseService");
        let database = database::DatabaseService::new(db_pool.clone());
        db_service_init.success(None);

        // SheetsService 초기화 - 구조화된 로깅 사용
        let sheets_init = ServiceInitializer::new("SheetsService");
        let sheets = sheets::SheetsService::new(
            config.clone(),
            http_client.clone(),
            cache.clone(),
        );
        sheets_init.success(None);

        let sa_path = config.google.service_account_key_path.clone().unwrap_or_default();
        let sa_configured = !sa_path.is_empty();
        tracing::info!(
            service = "GoogleServiceAccount",
            configured = %sa_configured,
            key_path = %(!sa_path.is_empty()),
            "Google service account key configuration"
        );
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
