use axum::{http::StatusCode, response::IntoResponse, Json};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use rusqlite::Connection;
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
}

impl AppState {
    pub fn from_env() -> Arc<Self> {
        let jwt_secret = std::env::var("JWT_SECRET").ok();
        let node_env = std::env::var("NODE_ENV").unwrap_or_else(|_| "development".into());
        let is_production = node_env == "production";
        let db_path = std::env::var("DB_PATH").unwrap_or_else(|_| "./data.db".into());
        let frontend_url = std::env::var("FRONTEND_URL").unwrap_or_else(|_| {
            if is_production {
                "https://young-buddha.online".into() // 프로덕션 도메인으로 변경 필요
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

            -- Google OAuth tokens per user (for Sheets API on behalf of the user)
            CREATE TABLE IF NOT EXISTS user_tokens (
                email TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at INTEGER NOT NULL
            );
            "#,
        ).expect("failed to create tables");

        // build shared http client
    let http_client = Client::new();

    // optional redis client (reused across requests if configured)
    let redis_client = std::env::var("REDIS_URL").ok().and_then(|u| redis::Client::open(u).ok());

    Arc::new(Self { jwt_secret, is_production, db_path, frontend_url, http_client, redis_client })
    }
}

// ======== Auth Types ========

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
}

#[derive(Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: Option<String>,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
    #[allow(dead_code)]
    pub id_token: Option<String>,
}

#[derive(Deserialize)]
pub struct GoogleUserInfo {
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct JwtClaims {
    pub name: String,
    pub email: String,
    pub role: String,
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuthClaims {
    #[allow(dead_code)] 
    pub sub: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    #[allow(dead_code)] 
    pub exp: Option<i64>,
    #[allow(dead_code)] 
    pub access_token: Option<String>,
    #[allow(dead_code)] 
    pub refresh_token: Option<String>,
}

// ======== Database Types ========

#[derive(Debug, Deserialize)]
pub struct CreateRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub request_date: String,
    pub absent_date: Option<String>,
    pub partial_schedule: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DatabaseRow {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub request_date: String,
    pub absent_date: Option<String>,
    pub partial_schedule: Option<String>,
    pub reason: Option<String>,
}

// ======== Sheets API Types ========

// Visualization API Query Language 기반 쿼리 핸들러
#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub spreadsheet_id: String,
    pub sheet_name: String,
    // allow alias "read" for backward/forward compatibility when renaming
    #[serde(alias = "read")]
    pub query: String,
}

// 공통 파라미터 (CRUD 모두 동일한 형식: spreadsheet_id, sheet_name, query)
#[derive(Debug, Deserialize)]
pub struct CommonParams {
    pub spreadsheet_id: String,
    pub sheet_name: String,
    pub query: String,
}

// Google refresh token 응답
#[derive(Deserialize)]
pub struct GoogleRefreshResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: Option<String>,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
}

// JWT Claims for sheets
#[derive(serde::Deserialize)]
pub struct SheetsClaims {
    pub email: Option<String>,
}

// ======== Error Types ========

// 에러 응답 타입
#[derive(Debug)]
pub struct ApiError {
    pub status: StatusCode,
    pub code: &'static str,
    pub message: String,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "NOT_AUTHENTICATED", message)
    }

    pub fn bad_request(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, code, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "ROW_NOT_FOUND", message)
    }

    pub fn bad_gateway(code: &'static str, message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_GATEWAY, code, message)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        (
            self.status,
            Json(json!({
                "error": true,
                "code": self.code,
                "message": self.message
            }))
        ).into_response()
    }
}