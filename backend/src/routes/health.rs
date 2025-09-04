use axum::{extract::State, Json};
use serde::Serialize;
use std::sync::Arc;

use crate::services::AppServices;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub db: &'static str,
    pub redis: Option<&'static str>,
}

pub async fn health(State(services): State<Arc<AppServices>>) -> Json<HealthResponse> {
    // DB 상태 확인 - 새로운 메소드 사용
    let db_ok = services.database.health_check().await;

    // Redis 상태 확인 (옵션)
    let redis_status = if let Some(cache) = &services.auth.cache {
        // 간단한 테스트 키로 redis 연결 확인
        match cache.set("health_check", "ok", 10).await {
            Ok(_) => Some("ok"),
            Err(_) => Some("error"),
        }
    } else {
        None
    };

    Json(HealthResponse {
        status: "ok",
        db: if db_ok { "ok" } else { "error" },
        redis: redis_status,
    })
}
