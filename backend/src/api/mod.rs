use axum::Router;

pub fn build_router() -> Router {
    Router::new()
    // .route("/health", get(handlers::health))
}

// pub mod handlers; // 추후 handlers 모듈 추가
