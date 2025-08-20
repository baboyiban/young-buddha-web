use axum::{
    extract::{Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;
use crate::types::AppState;
use crate::types::{QueryParams, CommonParams};
use crate::services::SheetsService;

// Public router (OAuth only)
pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/sheets/read", get(query_sheet))
        .route("/sheets/create", post(create_with_query))
        .route("/sheets/update", post(update_with_query))
        .route("/sheets/delete", post(delete_by_query))
}

// GET /api/sheets/query?spreadsheet_id=...&sheet_name=...&query=...
async fn query_sheet(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<QueryParams>,
) -> axum::response::Response {
    match SheetsService::query_sheet(state, headers, params).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn create_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> axum::response::Response {
    match SheetsService::create_with_query(state, headers, params).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn update_with_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> axum::response::Response {
    match SheetsService::update_with_query(state, headers, params).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}

async fn delete_by_query(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> axum::response::Response {
    match SheetsService::delete_by_query(state, headers, params).await {
        Ok(response) => response,
        Err(err) => err.into_response(),
    }
}
