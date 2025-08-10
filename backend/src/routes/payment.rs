use axum::{Router, routing::{get, post}, response::{IntoResponse, Response}, Json};
use serde_json::json;

pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/payment", get(not_implemented))
        .route("/payment", post(not_implemented))
}

async fn not_implemented() -> Response {
    (
        axum::http::StatusCode::NOT_IMPLEMENTED,
        Json(json!({"error":"Not implemented yet (Rust port)"})),
    ).into_response()
}
