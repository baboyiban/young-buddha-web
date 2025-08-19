use axum::{Router, routing::{get, post}, response::IntoResponse, Json, extract::State};
use serde_json::json;
use crate::types::AppState;
use crate::types::{CreateRequest, DatabaseRow, ApiError};
use rusqlite::Connection;
use std::sync::Arc;
use tokio::task;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/database", post(create))
        .route("/database", get(list))
}



async fn create(State(state): State<Arc<AppState>>, Json(body): Json<CreateRequest>) -> impl IntoResponse {
    // move owned fields into the blocking task
    let db_path = state.db_path.clone();
    let name = body.name;
    let kind = body.kind;
    let request_date = body.request_date;
    let absent_date = body.absent_date;
    let partial_schedule = body.partial_schedule;
    let reason = body.reason;

    let res = task::spawn_blocking(move || {
        let sql = "INSERT INTO database_request (name, type, request_date, absent_date, partial_schedule, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)";
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute(
            sql,
            (
                &name,
                &kind,
                &request_date,
                &absent_date,
                &partial_schedule,
                &reason,
            ),
        ).map_err(|e| e.to_string())?;
        Ok::<(), String>(())
    }).await;

    match res {
        Ok(Ok(())) => (axum::http::StatusCode::CREATED, Json(json!({"success":true}))).into_response(),
        Ok(Err(e)) => ApiError::bad_gateway("DB_ERROR", format!("DB error: {}", e)).into_response(),
        Err(join_err) => ApiError::bad_gateway("DB_TASK_FAILED", format!("DB task failed: {}", join_err)).into_response(),
    }
}

async fn list(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let db_path = state.db_path.clone();
    let res = task::spawn_blocking(move || {
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM database_request",
        ).map_err(|e| e.to_string())?;

        let rows_iter = stmt.query_map([], |row| {
            Ok(DatabaseRow {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get::<_, String>(2)?,
                request_date: row.get(3)?,
                absent_date: row.get(4)?,
                partial_schedule: row.get(5)?,
                reason: row.get(6)?,
            })
        }).map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows_iter {
            list.push(r.map_err(|e| e.to_string())?);
        }
        Ok::<_, String>(list)
    }).await;

    match res {
        Ok(Ok(list)) => (axum::http::StatusCode::OK, Json(list)).into_response(),
        Ok(Err(e)) => ApiError::bad_gateway("DB_ERROR", format!("DB error: {}", e)).into_response(),
        Err(join_err) => ApiError::bad_gateway("DB_TASK_FAILED", format!("DB task failed: {}", join_err)).into_response(),
    }
}
