use crate::types::{AppState, CreateRequest, DatabaseRow, ApiError};
use crate::db::pool::get_connection;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde_json::json;
use std::sync::Arc;

pub struct DatabaseService;

impl DatabaseService {
    pub async fn create_request(
        state: Arc<AppState>,
        request: CreateRequest,
    ) -> Result<axum::response::Response, ApiError> {
        let conn = get_connection(&state.db_path)
            .map_err(|e| ApiError::internal_error(format!("데이터베이스 연결 실패: {}", e)))?;

        let result = conn.execute(
            "INSERT INTO database_request (name, type, request_date, absent_date, partial_schedule, reason) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            (
                &request.name,
                &request.kind,
                &request.request_date,
                &request.absent_date,
                &request.partial_schedule,
                &request.reason,
            ),
        );

        match result {
            Ok(_) => {
                let response = json!({
                    "success": true,
                    "message": "요청이 성공적으로 생성되었습니다"
                });
                Ok((StatusCode::CREATED, Json(response)).into_response())
            }
            Err(e) => {
                tracing::error!("Database insert error: {}", e);
                Err(ApiError::internal_error("데이터베이스 저장 실패"))
            }
        }
    }

    pub async fn get_all_requests(
        state: Arc<AppState>,
    ) -> Result<axum::response::Response, ApiError> {
        let conn = get_connection(&state.db_path)
            .map_err(|e| ApiError::internal_error(format!("데이터베이스 연결 실패: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM database_request ORDER BY request_date DESC"
        )
        .map_err(|e| ApiError::internal_error(format!("쿼리 준비 실패: {}", e)))?;

        let rows = stmt.query_map([], |row| {
            Ok(DatabaseRow {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                request_date: row.get(3)?,
                absent_date: row.get(4)?,
                partial_schedule: row.get(5)?,
                reason: row.get(6)?,
            })
        })
        .map_err(|e| ApiError::internal_error(format!("쿼리 실행 실패: {}", e)))?;

        let mut requests = Vec::new();
        for row in rows {
            match row {
                Ok(request) => requests.push(request),
                Err(e) => {
                    tracing::error!("Row parsing error: {}", e);
                    return Err(ApiError::internal_error("데이터 파싱 실패"));
                }
            }
        }

        Ok((StatusCode::OK, Json(requests)).into_response())
    }

    pub async fn get_request_by_id(
        state: Arc<AppState>,
        id: i64,
    ) -> Result<axum::response::Response, ApiError> {
        let conn = get_connection(&state.db_path)
            .map_err(|e| ApiError::internal_error(format!("데이터베이스 연결 실패: {}", e)))?;

        let mut stmt = conn.prepare(
            "SELECT id, name, type, request_date, absent_date, partial_schedule, reason FROM database_request WHERE id = ?"
        )
        .map_err(|e| ApiError::internal_error(format!("쿼리 준비 실패: {}", e)))?;

        let row = stmt.query_row([id], |row| {
            Ok(DatabaseRow {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                request_date: row.get(3)?,
                absent_date: row.get(4)?,
                partial_schedule: row.get(5)?,
                reason: row.get(6)?,
            })
        });

        match row {
            Ok(request) => Ok((StatusCode::OK, Json(request)).into_response()),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                Err(ApiError::not_found("요청을 찾을 수 없습니다"))
            }
            Err(e) => {
                tracing::error!("Database query error: {}", e);
                Err(ApiError::internal_error("데이터베이스 조회 실패"))
            }
        }
    }

    pub async fn update_request(
        state: Arc<AppState>,
        id: i64,
        request: CreateRequest,
    ) -> Result<axum::response::Response, ApiError> {
        let conn = get_connection(&state.db_path)
            .map_err(|e| ApiError::internal_error(format!("데이터베이스 연결 실패: {}", e)))?;

        let result = conn.execute(
            "UPDATE database_request SET name = ?1, type = ?2, request_date = ?3, absent_date = ?4, partial_schedule = ?5, reason = ?6 WHERE id = ?7",
            (
                &request.name,
                &request.kind,
                &request.request_date,
                &request.absent_date,
                &request.partial_schedule,
                &request.reason,
                id,
            ),
        );

        match result {
            Ok(0) => Err(ApiError::not_found("업데이트할 요청을 찾을 수 없습니다")),
            Ok(_) => {
                let response = json!({
                    "success": true,
                    "message": "요청이 성공적으로 업데이트되었습니다"
                });
                Ok((StatusCode::OK, Json(response)).into_response())
            }
            Err(e) => {
                tracing::error!("Database update error: {}", e);
                Err(ApiError::internal_error("데이터베이스 업데이트 실패"))
            }
        }
    }

    pub async fn delete_request(
        state: Arc<AppState>,
        id: i64,
    ) -> Result<axum::response::Response, ApiError> {
        let conn = get_connection(&state.db_path)
            .map_err(|e| ApiError::internal_error(format!("데이터베이스 연결 실패: {}", e)))?;

        let result = conn.execute(
            "DELETE FROM database_request WHERE id = ?",
            [id],
        );

        match result {
            Ok(0) => Err(ApiError::not_found("삭제할 요청을 찾을 수 없습니다")),
            Ok(_) => {
                let response = json!({
                    "success": true,
                    "message": "요청이 성공적으로 삭제되었습니다"
                });
                Ok((StatusCode::OK, Json(response)).into_response())
            }
            Err(e) => {
                tracing::error!("Database delete error: {}", e);
                Err(ApiError::internal_error("데이터베이스 삭제 실패"))
            }
        }
    }
} 