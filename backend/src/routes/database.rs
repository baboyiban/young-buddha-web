use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use std::sync::Arc;
use crate::types::AppState;
use crate::types::{CreateRequest};
use crate::services::DatabaseService;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/database/requests", post(create_request))
        .route("/database/requests", get(get_all_requests))
        .route("/database/requests/:id", get(get_request_by_id))
        .route("/database/requests/:id", put(update_request))
        .route("/database/requests/:id", delete(delete_request))
}

async fn create_request(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateRequest>,
) -> axum::response::Response {
    match DatabaseService::create_request(state, request).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn get_all_requests(
    State(state): State<Arc<AppState>>,
) -> axum::response::Response {
    match DatabaseService::get_all_requests(state).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn get_request_by_id(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> axum::response::Response {
    match DatabaseService::get_request_by_id(state, id).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn update_request(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(request): Json<CreateRequest>,
) -> axum::response::Response {
    match DatabaseService::update_request(state, id, request).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn delete_request(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> axum::response::Response {
    match DatabaseService::delete_request(state, id).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}
