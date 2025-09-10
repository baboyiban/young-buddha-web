use axum::{
    extract::{Query, State},
    http::HeaderMap,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::services::AppServices;
use crate::types::{AppError, QueryParams, CommonParams};

pub fn router() -> Router<Arc<AppServices>> {
    Router::new()
        .route("/read", get(query_sheet))
        .route("/create", post(create_with_query))
        .route("/update", post(update_with_query))
        .route("/delete", post(delete_by_query))
}

#[axum::debug_handler]
async fn query_sheet(
    State(services): State<Arc<AppServices>>,
    Query(params): Query<QueryParams>,
    headers: HeaderMap,
) -> impl IntoResponse {
    match get_access_token(&services, &headers).await {
        Ok(token) => {
            match services.sheets.query_sheet(params, &token).await {
                Ok(response) => response,
                Err(err) => err.into_response(),
            }
        }
        Err(err) => err.into_response(),
    }
}

#[axum::debug_handler]
async fn create_with_query(
    State(services): State<Arc<AppServices>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    match get_access_token(&services, &headers).await {
        Ok(token) => {
            match services.sheets.create_with_query(params, &token).await {
                Ok(response) => response,
                Err(err) => err.into_response(),
            }
        }
        Err(err) => err.into_response(),
    }
}

#[axum::debug_handler]
async fn update_with_query(
    State(services): State<Arc<AppServices>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    match get_access_token(&services, &headers).await {
        Ok(token) => {
            match services.sheets.update_with_query(params, &token).await {
                Ok(response) => response,
                Err(err) => err.into_response(),
            }
        }
        Err(err) => err.into_response(),
    }
}

#[axum::debug_handler]
async fn delete_by_query(
    State(services): State<Arc<AppServices>>,
    headers: HeaderMap,
    Json(params): Json<CommonParams>,
) -> impl IntoResponse {
    match get_access_token(&services, &headers).await {
        Ok(token) => {
            match services.sheets.delete_by_query(params, &token).await {
                Ok(response) => response,
                Err(err) => err.into_response(),
            }
        }
        Err(err) => err.into_response(),
    }
}

async fn get_access_token(services: &AppServices, headers: &HeaderMap) -> Result<String, AppError> {
    // 먼저 사용자 토큰 시도
    if let Some(email) = services.auth.jwt_service.extract_email_from_headers(headers) {
        if let Some(user_token) = services.auth.get_valid_user_token(&email).await {
            return Ok(user_token);
        }
    }

    // 사용자 토큰이 없으면 서비스 계정 토큰 사용
    // Clone 대신 새로운 인스턴스 생성
    let key_path = services.auth.config.google.service_account_key_path.clone()
        .ok_or_else(|| AppError::Config("GOOGLE_SERVICE_ACCOUNT_KEY_PATH not configured".to_string()))?;
    tracing::debug!("Service account key path: '{}'", key_path);
    let mut sa_auth = crate::services::google_service_account::GoogleServiceAccountAuth::new(key_path);
    sa_auth.get_access_token().await
}
