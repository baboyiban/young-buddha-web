use axum::{extract::State, Json};
use serde::Serialize;
use crate::types::AppState;
use std::sync::Arc;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub db: &'static str,
    pub redis: Option<&'static str>,
}

pub async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    // DB check: try opening a connection in blocking threadpool
    let db_path = state.db_path.clone();
    let db_ok = tokio::task::spawn_blocking(move || -> bool {
        rusqlite::Connection::open(db_path).map(|_| true).unwrap_or(false)
    }).await.unwrap_or(false);

    // Redis check: if configured, attempt a PING using blocking API
    let redis_ok = if let Some(client) = &state.redis_client {
        let client = client.clone();
        let ok = tokio::task::spawn_blocking(move || -> Option<bool> {
            if let Ok(mut conn) = client.get_connection() {
                let pong: Result<String, _> = redis::cmd("PING").query(&mut conn);
                return pong.map(|_| true).ok();
            }
            None
        }).await.unwrap_or(None);
        ok
    } else {
        None
    };

    Json(HealthResponse { status: "ok", db: if db_ok { "ok" } else { "error" }, redis: redis_ok.map(|b| if b { "ok" } else { "error" } ) })
}
