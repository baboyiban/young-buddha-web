use std::sync::Arc;
use rusqlite::Connection;

#[derive(Clone)]
pub struct AppState {
    pub jwt_secret: Option<String>,
    pub is_production: bool,
    pub db_path: String,
    pub frontend_url: String,
}

impl AppState {
    pub fn from_env() -> Arc<Self> {
        let jwt_secret = std::env::var("JWT_SECRET").ok();
        let node_env = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".into());
        let is_production = node_env == "production";
        let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "../backend/data.db".into());
        let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| {
            if is_production {
                "https://your-domain.com".into() // 프로덕션 도메인으로 변경 필요
            } else {
                "http://localhost:3000".into() // 개발 환경
            }
        });

    // open sqlite and ensure schema exists (drop connection after init)
    let db = Connection::open(&db_path).expect("failed to open sqlite db");
    db.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS database_request (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                request_date TEXT NOT NULL,
                absent_date TEXT,
                partial_schedule TEXT,
                reason TEXT
            );
            "#,
        ).expect("failed to create tables");

    Arc::new(Self { jwt_secret, is_production, db_path, frontend_url })
    }
}
