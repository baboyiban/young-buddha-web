use axum::{
    extract::{Path, State},
    response::IntoResponse,
    routing::{get, post, put, delete},
    Json, Router,
};
use std::sync::Arc;

use crate::services::AppServices;
use crate::types::CreateRequest;

pub fn router() -> Router<Arc<AppServices>> {
    Router::new()
        .route("/requests", post(create_request))
        .route("/requests", get(get_all_requests))
        .route("/requests/:id", get(get_request_by_id))
        .route("/requests/:id", put(update_request))
        .route("/requests/:id", delete(delete_request))
}

async fn create_request(
    State(services): State<Arc<AppServices>>,
    Json(request): Json<CreateRequest>,
) -> axum::response::Response {
    match services.database.create_request(request).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn get_all_requests(
    State(services): State<Arc<AppServices>>,
) -> axum::response::Response {
    match services.database.get_all_requests().await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn get_request_by_id(
    State(services): State<Arc<AppServices>>,
    Path(id): Path<i64>,
) -> axum::response::Response {
    match services.database.get_request_by_id(id).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn update_request(
    State(services): State<Arc<AppServices>>,
    Path(id): Path<i64>,
    Json(request): Json<CreateRequest>,
) -> axum::response::Response {
    match services.database.update_request(id, request).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn delete_request(
    State(services): State<Arc<AppServices>>,
    Path(id): Path<i64>,
) -> axum::response::Response {
    match services.database.delete_request(id).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}
