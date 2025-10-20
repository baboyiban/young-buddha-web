use crate::types::error::AppError;
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub cache: CacheConfig,
    pub google: GoogleConfig,
    pub database: DatabaseConfig,
}

#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub port: u16,
    pub environment: Environment,
    pub frontend_url: String,
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_expiry_seconds: i64,
    pub cookie_domain: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CacheConfig {
    pub redis_url: Option<String>,
    pub default_ttl: i64,
    pub sheets_cache_ttl: i64,
    pub user_profile_ttl: i64,
}

#[derive(Clone, Debug)]
pub struct GoogleConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub service_account_key_path: Option<String>,
    pub user_sheet_spreadsheet_id: Option<String>,
    pub user_sheet_name: Option<String>,
}

#[derive(Clone, Debug)]
pub struct DatabaseConfig {
    pub path: String,
}

#[derive(Clone, Debug, PartialEq)]
pub enum Environment {
    Development,
    Production,
}

impl Config {
    pub fn from_env() -> Result<Self, AppError> {
        // 환경 파일을 먼저 로드하여 필요한 환경변수가 채워지도록 함
        load_env_file();

        let environment = match env::var("NODE_ENV").as_deref() {
            Ok("production") => Environment::Production,
            _ => Environment::Development,
        };

        let server = ServerConfig {
            port: env::var("PORT")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(8080),
            environment: environment.clone(),
            frontend_url: env::var("FRONTEND_URL").unwrap_or_else(|_| match environment {
                Environment::Production => "https://young-buddha.online".to_string(),
                Environment::Development => "http://localhost:3000".to_string(),
            }),
        };

        let auth = AuthConfig {
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| AppError::Config("JWT_SECRET is required".to_string()))?,
            jwt_expiry_seconds: env::var("JWT_EXPIRY_SECONDS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60 * 60 * 24 * 7), // 7 days
            cookie_domain: env::var("COOKIE_DOMAIN").ok(),
        };

        let cache = CacheConfig {
            redis_url: env::var("REDIS_URL").ok(),
            default_ttl: 3600,      // 1 hour
            sheets_cache_ttl: 30,   // 30 seconds
            user_profile_ttl: 1800, // 30 minutes
        };

        // Google redirect URI: if not explicitly set, default to FRONTEND_URL + /api/auth/google/callback
        let default_redirect = format!(
            "{}/api/auth/google/callback",
            server.frontend_url.trim_end_matches('/')
        );
        let google = GoogleConfig {
            client_id: env::var("GOOGLE_CLIENT_ID")
                .map_err(|_| AppError::Config("GOOGLE_CLIENT_ID is required".to_string()))?,
            client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .map_err(|_| AppError::Config("GOOGLE_CLIENT_SECRET is required".to_string()))?,
            redirect_uri: env::var("GOOGLE_REDIRECT_URI").unwrap_or(default_redirect),
            service_account_key_path: env::var("GOOGLE_SERVICE_ACCOUNT_KEY_PATH").ok(),
            user_sheet_spreadsheet_id: env::var("USER_SHEET_SPREADSHEET_ID").ok(),
            user_sheet_name: env::var("USER_SHEET_NAME").ok(),
        };

        let database = DatabaseConfig {
            path: Self::normalize_db_path(
                env::var("DB_PATH")
                    .or_else(|_| env::var("DATABASE_URL"))
                    .unwrap_or_else(|_| "./data/data.db".to_string()),
            ),
        };

        Ok(Self {
            server,
            auth,
            cache,
            google,
            database,
        })
    }

    fn normalize_db_path(raw_path: String) -> String {
        if let Some(stripped) = raw_path.strip_prefix("sqlite://") {
            stripped.to_string()
        } else if let Some(stripped) = raw_path.strip_prefix("sqlite:") {
            stripped.to_string()
        } else {
            raw_path
        }
    }
}

// 환경 파일 로딩 함수 추가
pub fn load_env_file() {
    // 기본 .env 파일 시도 (선택사항)
    let _ = dotenvy::dotenv().ok();

    // 환경에 따른 파일 결정
    let env_file = match env::var("NODE_ENV").as_deref() {
        Ok("production") => ".env.prod",
        _ => ".env.dev",
    };

    match dotenvy::from_path(env_file) {
        Ok(_) => tracing::info!("환경 파일 로드 완료: {}", env_file),
        Err(_) => tracing::warn!("환경 파일을 찾을 수 없습니다: {}", env_file),
    }
}
