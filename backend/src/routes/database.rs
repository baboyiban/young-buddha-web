use axum::{Router, routing::{get, post}, response::IntoResponse, Json, extract::State};
use serde_json::json;
use crate::state::AppState;
use crate::types::{CreateRequest, DatabaseRow};
use rusqlite::Connection;
use std::sync::Arc;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/database", post(create))
        .route("/database", get(list))
}



async fn create(State(state): State<Arc<AppState>>, Json(body): Json<CreateRequest>) -> impl IntoResponse {
    let sql = "INSERT INTO database_request (name, type, request_date, absent_date, partial_schedule, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)";
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(err) => return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":format!("DB open error: {}", err)})),
        ).into_response(),
    };
    match conn.execute(
        sql,
        (
            &body.name,
            &body.kind,
            &body.request_date,
            &body.absent_date,
            &body.partial_schedule,
            &body.reason,
        ),
    ) {
        Ok(_) => (axum::http::StatusCode::CREATED, Json(json!({"success":true}))).into_response(),
        Err(err) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":format!("DB error: {}", err)})),
        ).into_response(),
    }
}

async fn list(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let conn = match Connection::open(&state.db_path) {
        Ok(c) => c,
        Err(err) => return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":format!("DB open error: {}", err)})),
        ).into_response(),
    };
    let mut stmt = match conn.prepare(
        "SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM database_request",
    ) {
        Ok(s) => s,
        Err(err) => return (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":format!("DB error: {}", err)})),
        ).into_response(),
    };

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
    });

    match rows_iter {
        Ok(iter) => {
            let mut list = Vec::new();
            for r in iter {
                match r {
                    Ok(item) => list.push(item),
                    Err(err) => return (
                        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                        Json(json!({"error":true,"message":format!("DB row error: {}", err)})),
                    ).into_response(),
                }
            }
            (axum::http::StatusCode::OK, Json(list)).into_response()
        }
        Err(err) => (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error":true,"message":format!("DB error: {}", err)})),
        ).into_response(),
    }
}
