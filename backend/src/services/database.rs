use std::sync::Arc;
use axum::{http::StatusCode, response::IntoResponse, Json};
use serde_json::json;
use rusqlite::OptionalExtension;

use crate::db::DatabasePool;
use crate::types::{AppError, CreateRequest, DatabaseRow};
use crate::utils::logging::{PerformanceMonitor, log_health_check, log_db_operation};

pub struct DatabaseService {
    pub db_pool: Arc<DatabasePool>,  // public으로 변경
}

impl DatabaseService {
    pub fn new(db_pool: Arc<DatabasePool>) -> Self {
        Self { db_pool }
    }

    // 헬스체크용 메소드 추가 (구조화된 로깅 & 성능 모니터링)
    pub async fn health_check(&self) -> bool {
        let monitor = PerformanceMonitor::new("db_health_check");

        let result = match self.db_pool.run_blocking(|conn| {
            // Use query_row for statements that return rows instead of execute
            match conn.query_row("SELECT 1", [], |_row| Ok(())) {
                Ok(_) => Ok(true),
                Err(e) => {
                    tracing::error!(component = "database", error = %e, "DB health query failed");
                    Ok(false)
                }
            }
        }).await {
            Ok(res) => res,
            Err(e) => {
                tracing::error!(component = "database", error = ?e, "DB health_check task failed");
                false
            },
        };

        // 성능 및 헬스 로그 기록
        monitor.complete(result);
        log_health_check("database", result, None);

        result
    }

    pub async fn create_request(&self, request: CreateRequest) -> Result<axum::response::Response, AppError> {
        // DB 삽입 성능 모니터링
        let monitor = PerformanceMonitor::new("db_insert_request");

        let rows_affected = self.db_pool.run_blocking({
            move |conn| -> Result<usize, AppError> {
                let affected = conn.execute(
                    "INSERT INTO database_request (name, type, request_date, absent_date, partial_schedule, reason)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    (
                        &request.name,
                        &request.kind,
                        &request.request_date,
                        &request.absent_date,
                        &request.partial_schedule,
                        &request.reason,
                    ),
                )?;
                Ok(affected)
            }
        }).await?;

        // 모니터 종료 및 DB 연산 로그
        let success = rows_affected > 0;
        monitor.complete(success);
        log_db_operation("insert", "database_request", success, 0, Some(rows_affected));

        let response = json!({
            "success": true,
            "message": "요청이 성공적으로 생성되었습니다"
        });

        Ok((StatusCode::CREATED, Json(response)).into_response())
    }

    pub async fn get_all_requests(&self) -> Result<axum::response::Response, AppError> {
        let requests = self.db_pool.run_blocking({
            move |conn| -> Result<Vec<DatabaseRow>, AppError> {
                let mut stmt = conn.prepare(
                    "SELECT id, name, type, request_date, absent_date, partial_schedule, reason
                     FROM database_request ORDER BY request_date DESC"
                )?;

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
                })?;

                let mut requests = Vec::new();
                for row in rows {
                    requests.push(row?);
                }

                Ok(requests)
            }
        }).await?;

        Ok((StatusCode::OK, Json(requests)).into_response())
    }

    pub async fn get_request_by_id(&self, id: i64) -> Result<axum::response::Response, AppError> {
        let request = self.db_pool.run_blocking({
            move |conn| -> Result<Option<DatabaseRow>, AppError> {
                let mut stmt = conn.prepare(
                    "SELECT id, name, type, request_date, absent_date, partial_schedule, reason
                     FROM database_request WHERE id = ?1"
                )?;

                let result = stmt.query_row([id], |row| {
                    Ok(DatabaseRow {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        kind: row.get(2)?,
                        request_date: row.get(3)?,
                        absent_date: row.get(4)?,
                        partial_schedule: row.get(5)?,
                        reason: row.get(6)?,
                    })
                }).optional()?;

                Ok(result)
            }
        }).await?;

        match request {
            Some(req) => Ok((StatusCode::OK, Json(req)).into_response()),
            None => Err(AppError::not_found("요청을 찾을 수 없습니다")),
        }
    }

    pub async fn update_request(&self, id: i64, request: CreateRequest) -> Result<axum::response::Response, AppError> {
        let monitor = PerformanceMonitor::new("db_update_request");

        let rows_affected = self.db_pool.run_blocking({
            move |conn| -> Result<usize, AppError> {
                let affected = conn.execute(
                    "UPDATE database_request
                     SET name = ?1, type = ?2, request_date = ?3, absent_date = ?4, partial_schedule = ?5, reason = ?6
                     WHERE id = ?7",
                    (
                        &request.name,
                        &request.kind,
                        &request.request_date,
                        &request.absent_date,
                        &request.partial_schedule,
                        &request.reason,
                        id,
                    ),
                )?;
                Ok(affected)
            }
        }).await?;

        let success = rows_affected > 0;
        monitor.complete(success);
        log_db_operation("update", "database_request", success, 0, Some(rows_affected));

        if rows_affected == 0 {
            return Err(AppError::not_found("업데이트할 요청을 찾을 수 없습니다"));
        }

        let response = json!({
            "success": true,
            "message": "요청이 성공적으로 업데이트되었습니다"
        });

        Ok((StatusCode::OK, Json(response)).into_response())
    }

    pub async fn delete_request(&self, id: i64) -> Result<axum::response::Response, AppError> {
        let monitor = PerformanceMonitor::new("db_delete_request");

        let rows_affected = self.db_pool.run_blocking({
            move |conn| -> Result<usize, AppError> {
                let affected = conn.execute("DELETE FROM database_request WHERE id = ?1", [id])?;
                Ok(affected)
            }
        }).await?;

        let success = rows_affected > 0;
        monitor.complete(success);
        log_db_operation("delete", "database_request", success, 0, Some(rows_affected));

        if rows_affected == 0 {
            return Err(AppError::not_found("삭제할 요청을 찾을 수 없습니다"));
        }

        let response = json!({
            "success": true,
            "message": "요청이 성공적으로 삭제되었습니다"
        });

        Ok((StatusCode::OK, Json(response)).into_response())
    }
}
