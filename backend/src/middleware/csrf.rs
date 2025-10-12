use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};
use cookie::Cookie;

pub async fn csrf_protect(req: Request, next: Next) -> Response {
    let method = req.method().clone();
    let path = req.uri().path();

    // 안전한 메서드는 통과
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return next.run(req).await;
    }

    // OAuth 경로 예외 처리
    if path.starts_with("/api/auth/google") {
        return next.run(req).await;
    }

    let headers = req.headers();
    let header_token = headers
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let cookie_token = headers
        .get("cookie")
        .and_then(|v| v.to_str().ok())
        .map(|cookie_str| {
            // Parse cookies using the cookie crate for better security
            cookie_str
                .split(';')
                .filter_map(|part| Cookie::parse(part.trim().to_string()).ok())
                .find(|cookie| cookie.name() == "csrf_token")
                .map(|cookie| cookie.value().to_string())
                .unwrap_or_default()
        })
        .unwrap_or_default();

    if !header_token.is_empty() && header_token == cookie_token {
        return next.run(req).await;
    }

    tracing::error!("❌ CSRF token validation failed - Header: '{}', Cookie: '{}'", header_token, cookie_token);

    let error_response = serde_json::json!({
        "error": true,
        "code": "CSRF_TOKEN_INVALID",
        "message": "CSRF token is invalid or missing"
    });

    (StatusCode::FORBIDDEN, axum::Json(error_response)).into_response()
}
