use axum::{
    extract::Request,
    http::Method,
    middleware::Next,
    response::Response,
};
use crate::utils::cookie::CookieUtils;
use crate::utils::error::ErrorResponse;

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

    let cookie_token = CookieUtils::extract_token_from_cookie(headers, "csrf_token")
        .unwrap_or_default();

    if !header_token.is_empty() && header_token == cookie_token {
        return next.run(req).await;
    }

    tracing::error!("❌ CSRF token validation failed - Header: '{}', Cookie: '{}'", header_token, cookie_token);

    ErrorResponse::csrf_error("CSRF token is invalid or missing")
}
