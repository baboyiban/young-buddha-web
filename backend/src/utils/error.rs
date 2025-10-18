use axum::response::{IntoResponse, Response};
use axum::http::StatusCode;
use serde_json::json;

pub struct ErrorResponse;

impl ErrorResponse {
    /// 기본 에러 응답 (500)
    pub fn format(code: &str, message: &str) -> Response {
        let response = json!({
            "error": true,
            "code": code,
            "message": message
        });

        (StatusCode::INTERNAL_SERVER_ERROR, axum::Json(response)).into_response()
    }

    /// 상태 코드 지정이 가능한 에러 응답
    pub fn format_with_status(status: StatusCode, code: &str, message: &str) -> Response {
        let response = json!({
            "error": true,
            "code": code,
            "message": message
        });

        (status, axum::Json(response)).into_response()
    }

    /// CSRF 에러 전용
    pub fn csrf_error(message: &str) -> Response {
        Self::format_with_status(
            StatusCode::FORBIDDEN,
            "CSRF_TOKEN_INVALID",
            message
        )
    }
}

#[cfg(test)]
mod tests {
    use super::ErrorResponse;
    use axum::body;
    use axum::http::StatusCode;
    use axum::response::IntoResponse;

    #[tokio::test]
    async fn test_format() {
        let response = ErrorResponse::format("TEST_CODE", "Test message").into_response();
        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = body::to_bytes(response.into_body(), 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["error"], true);
        assert_eq!(body["code"], "TEST_CODE");
        assert_eq!(body["message"], "Test message");
    }

    #[tokio::test]
    async fn test_format_with_status() {
        let response = ErrorResponse::format_with_status(StatusCode::BAD_REQUEST, "TEST_CODE", "Test message").into_response();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body = body::to_bytes(response.into_body(), 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["error"], true);
        assert_eq!(body["code"], "TEST_CODE");
        assert_eq!(body["message"], "Test message");
    }

    #[tokio::test]
    async fn test_csrf_error() {
        let response = ErrorResponse::csrf_error("CSRF failed").into_response();
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body = body::to_bytes(response.into_body(), 1024).await.unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["error"], true);
        assert_eq!(body["code"], "CSRF_TOKEN_INVALID");
        assert_eq!(body["message"], "CSRF failed");
    }
}
