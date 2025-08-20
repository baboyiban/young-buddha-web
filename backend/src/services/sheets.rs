use crate::types::{AppState, QueryParams, CommonParams, ApiError};
use crate::auth_tokens::authenticate_and_get_token;
use crate::routes::sheets_client;
use crate::routes::sheets_parser;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::Value;
use std::sync::Arc;

pub struct SheetsService;

impl SheetsService {
    pub async fn query_sheet(
        state: Arc<AppState>,
        headers: HeaderMap,
        params: QueryParams,
    ) -> Result<axum::response::Response, ApiError> {
        // 1. 인증 및 토큰 검증
        let (_email, user_token) = authenticate_and_get_token(&headers, &state).await?;

        let client = &state.http_client;

        // 2. Visualization API 쿼리 실행
        let url = format!(
            "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
            params.spreadsheet_id,
            urlencoding::encode(&params.query),
            urlencoding::encode(&params.sheet_name)
        );

        let resp = client.get(&url).bearer_auth(&user_token).send().await
            .map_err(|e| ApiError::bad_gateway("NETWORK_FAILED", format!("네트워크 요청 실패: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let _body = resp.text().await.unwrap_or_default();
            return Err(ApiError::bad_gateway("SHEETS_API_FAILED", 
                format!("시트 쿼리 실패: {}", status)));
        }
        
        let text = resp.text().await.unwrap_or_default();
        let result = sheets_parser::parse_gviz_json(&text)
            .map_err(|e| e)?;
            
        Ok((StatusCode::OK, Json(result)).into_response())
    }

    pub async fn create_with_query(
        state: Arc<AppState>,
        headers: HeaderMap,
        params: CommonParams,
    ) -> Result<axum::response::Response, ApiError> {
        // 1. 인증 및 토큰 검증
        let (_email, user_token) = authenticate_and_get_token(&headers, &state).await?;

        let client = &state.http_client;

        // 2. 새로운 행 데이터 생성
        let new_row_data = Self::extract_insert_data_from_query(&params.query)?;

        // 3. 새 행 추가
        let result = sheets_client::append_row_to_sheet(&client, &params.spreadsheet_id, &params.sheet_name, &new_row_data, &user_token).await?;

        Ok((StatusCode::OK, Json(result)).into_response())
    }

    pub async fn update_with_query(
        state: Arc<AppState>,
        headers: HeaderMap,
        params: CommonParams,
    ) -> Result<axum::response::Response, ApiError> {
        // 1. 인증 및 토큰 검증
        let (_email, user_token) = authenticate_and_get_token(&headers, &state).await?;

        let client = &state.http_client;

        // 2. 전체 시트 데이터 조회
        let rows_all = sheets_client::fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await?;

        // 3. 쿼리에서 대상 ID와 업데이트 데이터 추출
        let (target_id, update_data) = Self::extract_update_data_from_query(&params.query)?;

        // 4. 대상 행 찾기
        let target_row_index = Self::find_row_by_id(&rows_all, target_id)?;

        // 5. 행 업데이트
        let result = sheets_client::update_row_in_sheet(&client, &params.spreadsheet_id, &params.sheet_name, target_row_index, &update_data, &user_token).await?;

        Ok((StatusCode::OK, Json(result)).into_response())
    }

    pub async fn delete_by_query(
        state: Arc<AppState>,
        headers: HeaderMap,
        params: CommonParams,
    ) -> Result<axum::response::Response, ApiError> {
        // 1. 인증 및 토큰 검증
        let (_email, user_token) = authenticate_and_get_token(&headers, &state).await?;

        let client = &state.http_client;

        // 2. 전체 시트 데이터 조회
        let rows_all = sheets_client::fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await?;

        // 3. 쿼리에서 대상 ID 추출
        let target_id = Self::extract_id_from_where_query(&params.query)?;

        // 4. 대상 행 찾기
        let target_row_index = Self::find_row_by_id(&rows_all, target_id)?;

        // 5. 행 삭제
        let result = sheets_client::delete_row_from_sheet(&client, &params.spreadsheet_id, &params.sheet_name, target_row_index, &user_token).await?;

        Ok((StatusCode::OK, Json(result)).into_response())
    }

    // 헬퍼 함수들
    fn extract_insert_data_from_query(query: &str) -> Result<Vec<Value>, ApiError> {
        // INSERT INTO table (col1, col2) VALUES (val1, val2) 형태의 쿼리 파싱
        if !query.to_uppercase().contains("INSERT INTO") {
            return Err(ApiError::bad_request("INVALID_QUERY", "INSERT 쿼리가 아닙니다"));
        }

        // 간단한 VALUES 파싱 (실제로는 더 정교한 파싱이 필요)
        if let Some(values_start) = query.to_uppercase().find("VALUES") {
            let values_part = &query[values_start + 6..];
            let values_part = values_part.trim().trim_matches('(').trim_matches(')');
            
            let values: Vec<Value> = values_part
                .split(',')
                .map(|v| {
                    let v = v.trim().trim_matches('\'');
                    if v.parse::<i64>().is_ok() {
                        Value::Number(v.parse().unwrap())
                    } else {
                        Value::String(v.to_string())
                    }
                })
                .collect();

            Ok(values)
        } else {
            Err(ApiError::bad_request("INVALID_QUERY", "VALUES 절을 찾을 수 없습니다"))
        }
    }

    fn extract_update_data_from_query(query: &str) -> Result<(i64, Vec<Value>), ApiError> {
        // UPDATE table SET col1=val1, col2=val2 WHERE id=123 형태의 쿼리 파싱
        if !query.to_uppercase().contains("UPDATE") || !query.to_uppercase().contains("WHERE") {
            return Err(ApiError::bad_request("INVALID_QUERY", "UPDATE 쿼리가 아닙니다"));
        }

        // ID 추출
        let target_id = Self::extract_id_from_where_query(query)?;

        // SET 절 파싱
        if let Some(set_start) = query.to_uppercase().find("SET") {
            let set_end = query.to_uppercase().find("WHERE").unwrap_or(query.len());
            let set_part = &query[set_start + 3..set_end];
            
            let update_data: Vec<Value> = set_part
                .split(',')
                .map(|pair| {
                    let parts: Vec<&str> = pair.split('=').collect();
                    if parts.len() == 2 {
                        let value = parts[1].trim().trim_matches('\'');
                        if value.parse::<i64>().is_ok() {
                            Value::Number(value.parse().unwrap())
                        } else {
                            Value::String(value.to_string())
                        }
                    } else {
                        Value::String("".to_string())
                    }
                })
                .collect();

            Ok((target_id, update_data))
        } else {
            Err(ApiError::bad_request("INVALID_QUERY", "SET 절을 찾을 수 없습니다"))
        }
    }

    fn extract_id_from_where_query(query: &str) -> Result<i64, ApiError> {
        // WHERE id=123 형태에서 ID 추출
        if let Some(where_start) = query.to_uppercase().find("WHERE") {
            let where_part = &query[where_start + 5..];
            if let Some(id_eq) = where_part.find("id=") {
                let id_part = &where_part[id_eq + 3..];
                let id_str = id_part.split_whitespace().next().unwrap_or("");
                id_str.parse::<i64>()
                    .map_err(|_| ApiError::bad_request("INVALID_ID", "유효하지 않은 ID입니다"))
            } else {
                Err(ApiError::bad_request("INVALID_QUERY", "WHERE 절에서 id를 찾을 수 없습니다"))
            }
        } else {
            Err(ApiError::bad_request("INVALID_QUERY", "WHERE 절을 찾을 수 없습니다"))
        }
    }

    fn find_row_by_id(rows: &[Value], target_id: i64) -> Result<usize, ApiError> {
        for (i, row) in rows.iter().enumerate() {
            if let Some(id_val) = Self::get_row_id(row) {
                if id_val == target_id {
                    return Ok(i + 1); // Sheets API는 1-based indexing
                }
            }
        }
        Err(ApiError::not_found("지정된 ID의 행을 찾을 수 없습니다"))
    }

    fn get_row_id(row: &Value) -> Option<i64> {
        row.get("c")
            .and_then(|c| c.as_array())
            .and_then(|cells| cells.get(0))
            .and_then(|cell| cell.get("v"))
            .and_then(|v| v.as_i64())
    }
} 