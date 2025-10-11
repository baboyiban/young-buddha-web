use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Authorization failed: {0}")]
    Unauthorized(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("External API error: {0}")]
    ExternalApi(String),

    #[error("Cache error: {0}")]
    Cache(String),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),

    #[error("JSON parsing error: {0}")]
    JsonParse(#[from] serde_json::Error),

    #[error("Internal server error: {0}")]
    Internal(String),
}

impl AppError {
    pub fn unauthorized(msg: impl Into<String>) -> Self {
        Self::Unauthorized(msg.into())
    }

    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::NotFound(msg.into())
    }

    pub fn external_api(msg: impl Into<String>) -> Self {
        Self::ExternalApi(msg.into())
    }

    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, error_code) = match &self {
            AppError::Config(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CONFIG_ERROR"),
            AppError::Auth(_) => (StatusCode::UNAUTHORIZED, "AUTH_ERROR"),
            AppError::Unauthorized(_) => (StatusCode::UNAUTHORIZED, "UNAUTHORIZED"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            AppError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            AppError::Database(_) => (StatusCode::INTERNAL_SERVER_ERROR, "DATABASE_ERROR"),
            AppError::ExternalApi(_) => (StatusCode::BAD_GATEWAY, "EXTERNAL_API_ERROR"),
            AppError::Cache(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CACHE_ERROR"),
            AppError::Jwt(_) => (StatusCode::UNAUTHORIZED, "JWT_ERROR"),
            AppError::HttpClient(_) => (StatusCode::BAD_GATEWAY, "HTTP_CLIENT_ERROR"),
            AppError::JsonParse(_) => (StatusCode::BAD_REQUEST, "JSON_PARSE_ERROR"),
            AppError::Internal(_) => (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR"),
        };

        // 구조화된 에러 로깅
        match &self {
            AppError::Database(e) => {
                tracing::error!(
                    error_code = error_code,
                    error_type = "database",
                    error_details = ?e,
                    "Database operation failed"
                );
            }
            AppError::ExternalApi(e) => {
                tracing::error!(
                    error_code = error_code,
                    error_type = "external_api",
                    error_message = %e,
                    "External API call failed"
                );
            }
            AppError::HttpClient(e) => {
                tracing::error!(
                    error_code = error_code,
                    error_type = "http_client",
                    error_details = ?e,
                    "HTTP client error"
                );
            }
            _ => {
                tracing::error!(
                    error_code = error_code,
                    error_type = "application",
                    error_message = %self,
                    "Application error occurred"
                );
            }
        }

        (status, Json(json!({
            "error": true,
            "code": error_code,
            "message": self.to_string()
        }))).into_response()
    }
}
