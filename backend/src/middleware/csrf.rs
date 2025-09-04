use axum::{
    extract::Request,
    http::{Method, StatusCode},
    middleware::Next,
    response::Response,
};

pub async fn csrf_protect(req: Request, next: Next) -> Response {
    let method = req.method().clone();

    // 안전한 메서드는 통과
    if method == Method::GET || method == Method::HEAD || method == Method::OPTIONS {
        return next.run(req).await;
    }

    // OAuth 경로 예외 처리
    let path = req.uri().path();
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
        .and_then(|cookie_str| {
            cookie_str
                .split(';')
                .find_map(|part| {
                    let trimmed = part.trim();
                    if let Some((k, v)) = trimmed.split_once('=') {
                        if k == "csrf_token" { Some(v.to_string()) } else { None }
                    } else { None }
                })
        })
        .unwrap_or_default();

    if !header_token.is_empty() && header_token == cookie_token {
        return next.run(req).await;
    }

    Response::builder()
        .status(StatusCode::FORBIDDEN)
        .body(axum::body::Body::from("CSRF token invalid or missing"))
        .unwrap()
}
