use serde::Deserialize;
use std::env;

#[derive(Clone, Debug, Deserialize)]
pub struct AppConfig {
    pub port: u16,
    pub node_env: Option<String>,
    pub jwt_secret: Option<String>,
    pub redis_url: Option<String>,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub google_redirect_uri: Option<String>,
    pub db_path: String,
    pub frontend_url: String,
    // User sheet location for role/name lookup
    pub user_sheet_spreadsheet_id: Option<String>,
    pub user_sheet_name: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let port = env::var("PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
            .unwrap_or(8080);
        
        let node_env = env::var("NODE_ENV").ok();
        let jwt_secret = env::var("JWT_SECRET").ok();
        let redis_url = env::var("REDIS_URL").ok();
        let google_client_id = env::var("GOOGLE_CLIENT_ID").ok();
        let google_client_secret = env::var("GOOGLE_CLIENT_SECRET").ok();
        let google_redirect_uri = env::var("GOOGLE_REDIRECT_URI").ok();
        
        // Prefer DB_PATH; fallback to DATABASE_URL (normalize sqlite:// URI to filesystem path)
        let raw_db = env::var("DB_PATH")
            .or_else(|_| env::var("DATABASE_URL"))
            .unwrap_or_else(|_| "./data/data.db".into());
        let db_path = if let Some(stripped) = raw_db.strip_prefix("sqlite://") {
            // Handles both sqlite:///abs and sqlite://relative
            stripped.to_string()
        } else if let Some(stripped) = raw_db.strip_prefix("sqlite:") {
            // Defensive: in case a single-colon scheme sneaks in
            stripped.to_string()
        } else {
            raw_db
        };
        
        let is_production = Self::is_production_env(&node_env);
        let frontend_url = env::var("FRONTEND_URL").unwrap_or_else(|_| {
            if is_production {
                "https://young-buddha.online".into()
            } else {
                "http://localhost:3000".into()
            }
        });

        AppConfig {
            port,
            node_env,
            jwt_secret,
            redis_url,
            google_client_id,
            google_client_secret,
            google_redirect_uri,
            db_path,
            frontend_url,
            user_sheet_spreadsheet_id: env::var("USER_SHEET_SPREADSHEET_ID").ok(),
            user_sheet_name: env::var("USER_SHEET_NAME").ok(),
        }
    }

    pub fn is_production(&self) -> bool {
        Self::is_production_env(&self.node_env)
    }

    fn is_production_env(node_env: &Option<String>) -> bool {
        matches!(node_env.as_deref(), Some("production"))
    }

    pub fn validate_production_config(&self) -> Result<(), String> {
        if self.is_production() {
            if self.jwt_secret.is_none() {
                return Err("JWT_SECRET is required in production".into());
            }
            if self.google_client_id.is_none() {
                return Err("GOOGLE_CLIENT_ID is required in production".into());
            }
            if self.google_client_secret.is_none() {
                return Err("GOOGLE_CLIENT_SECRET is required in production".into());
            }
            if self.google_redirect_uri.is_none() {
                return Err("GOOGLE_REDIRECT_URI is required in production".into());
            }
        }
        Ok(())
    }

    pub fn get_google_client_id(&self) -> Result<String, String> {
        self.google_client_id.clone()
            .ok_or_else(|| "GOOGLE_CLIENT_ID not configured".into())
    }

    pub fn get_google_client_secret(&self) -> Result<String, String> {
        self.google_client_secret.clone()
            .ok_or_else(|| "GOOGLE_CLIENT_SECRET not configured".into())
    }

    pub fn get_google_redirect_uri(&self) -> Result<String, String> {
        self.google_redirect_uri.clone()
            .ok_or_else(|| "GOOGLE_REDIRECT_URI not configured".into())
    }

    pub fn get_user_sheet_spreadsheet_id(&self) -> Result<String, String> {
        self.user_sheet_spreadsheet_id
            .clone()
            .ok_or_else(|| "USER_SHEET_SPREADSHEET_ID not configured".into())
    }

    pub fn get_user_sheet_name(&self) -> Result<String, String> {
        self.user_sheet_name
            .clone()
            .ok_or_else(|| "USER_SHEET_NAME not configured".into())
    }
}
