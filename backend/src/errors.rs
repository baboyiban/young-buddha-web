use axum::response::{IntoResponse, Response};
use axum::http::StatusCode;
use serde::Serialize;

#[derive(Debug, Serialize)]
struct ErrorBody {
    error: String,
    message: Option<String>,
}

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("Not Found")] 
    NotFound,
    #[error("Unauthorized")] 
    Unauthorized,
    #[error("Bad Request: {0}")] 
    BadRequest(String),
    #[error("Internal Error")] 
    InternalError,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, None),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, None),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, Some(msg.clone())),
            AppError::InternalError => (StatusCode::INTERNAL_SERVER_ERROR, None),
        };
        let body = ErrorBody { error: format!("{}", self), message };
        (status, axum::Json(body)).into_response()
    }
}
