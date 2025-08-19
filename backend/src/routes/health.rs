use axum::{extract::State, Json};
use serde::Serialize;
use crate::types::AppState;
use std::sync::Arc;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

pub async fn health(State(_state): State<Arc<AppState>>) -> Json<HealthResponse> {
    // 가볍게 상태 검사 가능: DB 파일 경로 등
    Json(HealthResponse { status: "ok" })
}
