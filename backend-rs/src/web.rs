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

    let bytes = match fs::read(&file_path) {
        Ok(b) => b,
        Err(_) => {
            // SPA fallback to index.html
            let mut index_path = PathBuf::from(&state.static_files_path);
            index_path.push("index.html");
            match fs::read(&index_path) {
                Ok(b) => b,
                Err(_) => return (StatusCode::NOT_FOUND, "Not Found").into_response(),
            }
        }
    };

    // 간단한 콘텐츠 타입
    let content_type = if path.ends_with(".html") {
        "text/html; charset=utf-8"
    } else if path.ends_with(".js") {
        "application/javascript"
    } else if path.ends_with(".css") {
        "text/css"
    } else if path.ends_with(".svg") {
        "image/svg+xml"
    } else if path.ends_with(".json") {
        "application/json"
    } else {
        "application/octet-stream"
    };

    axum::response::Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .body(Body::from(bytes))
        .unwrap()
}
