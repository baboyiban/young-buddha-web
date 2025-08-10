use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub static_files_path: String,
    pub jwt_secret: Option<String>,
    pub is_production: bool,
}

impl AppState {
    pub fn from_env() -> Arc<Self> {
        let static_files_path = std::env::var("STATIC_FILES_PATH").unwrap_or_else(|_| "../frontend/dist".into());
        let jwt_secret = std::env::var("JWT_SECRET").ok();
        let node_env = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".into());
        let is_production = node_env == "production";
        Arc::new(Self { static_files_path, jwt_secret, is_production })
    }
}
