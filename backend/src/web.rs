use axum::{Router, response::IntoResponse, extract::State, http::{StatusCode, header}, body::Body};
use std::{path::PathBuf, fs};
use crate::state::AppState;
use std::sync::Arc;

pub fn static_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new().fallback(static_fallback).with_state(state)
}

async fn static_fallback(State(state): State<Arc<AppState>>, uri: axum::http::Uri) -> impl IntoResponse {
    let path = uri.path();
    // API는 404
    if path.starts_with("/api/") {
        return (StatusCode::NOT_FOUND, "Not Found").into_response();
    }

    // 파일 경로 계산
    let mut file_path = PathBuf::from(&state.static_files_path);
    let req_path = if path == "/" { "/index.html" } else { path };
    file_path.push(req_path.trim_start_matches('/'));

    // 실제로 서빙하는 파일 경로와 바이트를 결정
    let (served_path, bytes) = match fs::read(&file_path) {
        Ok(b) => (file_path.clone(), b),
        Err(_) => {
            // SPA fallback to index.html
            let mut index_path = PathBuf::from(&state.static_files_path);
            index_path.push("index.html");
            match fs::read(&index_path) {
                Ok(b) => (index_path, b),
                Err(_) => return (StatusCode::NOT_FOUND, "Not Found").into_response(),
            }
        }
    };

    // 실제 서빙 파일의 확장자를 기준으로 Content-Type 결정
    let content_type = match served_path.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "htm" => "text/html; charset=utf-8",
        "js" => "application/javascript",
        "mjs" => "application/javascript",
        "css" => "text/css",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "json" => "application/json",
        "txt" => "text/plain; charset=utf-8",
        "map" => "application/json",
        _ => "application/octet-stream",
    };

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(Body::from(bytes))
        .unwrap()
}
