use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct AppConfig {
    pub port: u16,
    pub node_env: Option<String>,
    pub jwt_secret: Option<String>,
    pub redis_url: Option<String>,
}

impl AppConfig {
    pub fn from_env() -> Self {
        let port = std::env::var("PORT").ok().and_then(|v| v.parse::<u16>().ok()).unwrap_or(8080);
        let node_env = std::env::var("NODE_ENV").ok();
        let jwt_secret = std::env::var("JWT_SECRET").ok();
        let redis_url = std::env::var("REDIS_URL").ok();
        AppConfig { port, node_env, jwt_secret, redis_url }
    }

    pub fn is_production(&self) -> bool {
        matches!(self.node_env.as_deref(), Some("production"))
    }
}
