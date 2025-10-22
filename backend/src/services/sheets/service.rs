use std::sync::Arc;
use axum::{http::StatusCode, response::IntoResponse, Json};
use reqwest::Client;
use serde_json::{json, Value};

use crate::config::Config;
use crate::cache::CacheProvider;
use crate::types::{AppError, QueryParams, CommonParams};
use super::{client::SheetsClient, parser};

pub struct SheetsService {
    config: Arc<Config>,
    client: SheetsClient,
    cache: Option<Arc<dyn CacheProvider>>,
}

impl SheetsService {
    pub fn new(
        config: Arc<Config>,
        http_client: Client,
        cache: Option<Arc<dyn CacheProvider>>,
    ) -> Self {
        let client = SheetsClient::new(http_client);

        Self {
            config,
            client,
            cache,
        }
    }

    pub async fn query_sheet(
        &self,
        params: QueryParams,
        access_token: &str,
    ) -> Result<axum::response::Response, AppError> {


        let mut final_query = params.query.clone();

        // 페이지네이션 적용
        if let Some(limit) = params.limit {
            final_query = format!("{} LIMIT {}", final_query, limit);
        }
        if let Some(offset) = params.offset {
            final_query = format!("{} OFFSET {}", final_query, offset);
        }

        // 캐시 확인 (해시 기반 키 + 버전)
        if let Some(cache) = &self.cache {
            let meta_key = format!("sheets:meta:{}:{}", params.spreadsheet_id, params.gid);
            let version = cache.get_hash(&meta_key, "version").await.unwrap_or_else(|| "0".to_string());
            let cache_key = cache.build_sheets_key(
                &params.spreadsheet_id,
                &params.gid,
                &format!("{}|v={}", final_query, version)
            );

            if let Some(cached_json) = cache.get(&cache_key).await {
                if let Ok(cached_value) = serde_json::from_str::<Value>(&cached_json) {

                    return Ok((StatusCode::OK, Json(cached_value)).into_response());
                }
            }
        }

        // API 호출
        let response_text = self.client.query_visualization_api(
            &params.spreadsheet_id,
            &params.gid,
            &final_query,
            access_token,
        ).await?;

        let result = parser::parse_gviz_json(&response_text)?;

        // 캐시 저장 (버전 포함)
        if let Some(cache) = &self.cache {
            let meta_key = format!("sheets:meta:{}:{}", params.spreadsheet_id, params.gid);
            let version = cache.get_hash(&meta_key, "version").await.unwrap_or_else(|| "0".to_string());
            let cache_key = cache.build_sheets_key(
                &params.spreadsheet_id,
                &params.gid,
                &format!("{}|v={}", final_query, version)
            );
            let _ = cache.set(&cache_key, &result.to_string(), self.config.cache.sheets_cache_ttl).await;
        }

        Ok((StatusCode::OK, Json(result)).into_response())
    }

    pub async fn create_with_query(
        &self,
        params: CommonParams,
        access_token: &str,
    ) -> Result<axum::response::Response, AppError> {
        let new_row_data = self.extract_insert_data_from_query(&params.query)?;

        self.client.append_row(
            &params.spreadsheet_id,
            &params.gid,
            &new_row_data,
            access_token,
        ).await?;

        // 캐시 버전 증가 (append 이후)
        if let Some(cache) = &self.cache {
            let meta_key = format!("sheets:meta:{}:{}", params.spreadsheet_id, params.gid);
            let cur = cache.get_hash(&meta_key, "version").await;
            let new_version = cur.and_then(|s| s.parse::<i64>().ok()).unwrap_or(0) + 1;
            let _ = cache.set_hash(&meta_key, "version", &new_version.to_string(), self.config.cache.sheets_cache_ttl).await;
        }

        let response = json!({
            "success": true,
            "message": "행이 성공적으로 추가되었습니다"
        });

        Ok((StatusCode::OK, Json(response)).into_response())
    }

    pub async fn update_with_query(
        &self,
        params: CommonParams,
        access_token: &str,
    ) -> Result<axum::response::Response, AppError> {
        // 전체 시트 데이터 조회
        let rows_all = self.fetch_all_sheet_data(
            &params.spreadsheet_id,
            &params.gid,
            access_token,
        ).await?;

        // WHERE 및 VALUES 파싱
        let (where_token, where_value) = self.extract_where_from_query(&params.query)?;
        let update_data = self.extract_values_array_from_query(&params.query)?;

        // 대상 행 찾기
        let col_idx_opt = self.resolve_column_index_optional(&where_token);
        let target_row_index = self.find_row_by_value(&rows_all, col_idx_opt, &where_value)
            .ok_or_else(|| AppError::not_found("지정된 조건에 해당하는 행을 찾을 수 없습니다"))?;

        // 행 업데이트
        self.client.update_row(
            &params.spreadsheet_id,
            &params.gid,
            target_row_index,
            &update_data,
            access_token,
        ).await?;

        // 캐시 버전 증가 (update 이후)
        if let Some(cache) = &self.cache {
            let meta_key = format!("sheets:meta:{}:{}", params.spreadsheet_id, params.gid);
            let cur = cache.get_hash(&meta_key, "version").await;
            let new_version = cur.and_then(|s| s.parse::<i64>().ok()).unwrap_or(0) + 1;
            let _ = cache.set_hash(&meta_key, "version", &new_version.to_string(), self.config.cache.sheets_cache_ttl).await;
        }

        let response = json!({
            "success": true,
            "message": "행이 성공적으로 업데이트되었습니다"
        });

        Ok((StatusCode::OK, Json(response)).into_response())
    }

    pub async fn delete_by_query(
        &self,
        params: CommonParams,
        access_token: &str,
    ) -> Result<axum::response::Response, AppError> {
        // 전체 시트 데이터 조회
        let rows_all = self.fetch_all_sheet_data(
            &params.spreadsheet_id,
            &params.gid,
            access_token,
        ).await?;

        // WHERE 파싱
        let (where_token, where_value) = self.extract_where_from_query(&params.query)?;

        // 대상 행 찾기
        let col_idx_opt = self.resolve_column_index_optional(&where_token);
        let target_row_index = self.find_row_by_value(&rows_all, col_idx_opt, &where_value)
            .ok_or_else(|| AppError::not_found("지정된 조건에 해당하는 행을 찾을 수 없습니다"))?;

        // 행 삭제 (gid를 직접 사용)
        self.client.delete_row(
            &params.spreadsheet_id,
            params.gid.parse().unwrap_or(0),
            target_row_index - 1, // 0-based index for deletion
            access_token,
        ).await?;

        // 캐시 버전 증가 (delete 이후)
        if let Some(cache) = &self.cache {
            let meta_key = format!("sheets:meta:{}:{}", params.spreadsheet_id, params.gid);
            let cur = cache.get_hash(&meta_key, "version").await;
            let new_version = cur.and_then(|s| s.parse::<i64>().ok()).unwrap_or(0) + 1;
            let _ = cache.set_hash(&meta_key, "version", &new_version.to_string(), self.config.cache.sheets_cache_ttl).await;
        }

        let response = json!({
            "success": true,
            "message": "행이 성공적으로 삭제되었습니다"
        });

        Ok((StatusCode::OK, Json(response)).into_response())
    }

    // Private helper methods
    async fn fetch_all_sheet_data(
        &self,
        spreadsheet_id: &str,
        gid: &str,
        access_token: &str,
    ) -> Result<Vec<Value>, AppError> {
        let response_text = self.client.query_visualization_api(
            spreadsheet_id,
            gid,
            "SELECT *",
            access_token,
        ).await?;

        let parsed = parser::parse_gviz_json(&response_text)?;

        Ok(parsed.get("table")
            .and_then(|t| t.get("rows"))
            .and_then(|r| r.as_array())
            .cloned()
            .unwrap_or_default())
    }

    fn extract_insert_data_from_query(&self, query: &str) -> Result<Vec<Value>, AppError> {
        if !query.to_ascii_uppercase().starts_with("INSERT") {
            return Err(AppError::validation("INSERT 쿼리가 아닙니다"));
        }

        let json_part = query[6..].trim();

        // JSON 배열 형태로 파싱 시도
        if let Ok(parsed) = serde_json::from_str::<Vec<Value>>(json_part) {
            return Ok(parsed);
        }

        // VALUES 구문 fallback
        if let Some(values_start) = query.to_ascii_uppercase().find("VALUES") {
            let values_part = &query[values_start + 6..];
            let values_part = values_part.trim().trim_matches('(').trim_matches(')');

            let values: Vec<Value> = values_part
                .split(',')
                .map(|v| {
                    let v = v.trim().trim_matches('\'').trim_matches('"');
                    if let Ok(num) = v.parse::<i64>() {
                        Value::Number(num.into())
                    } else {
                        Value::String(v.to_string())
                    }
                })
                .collect();

            return Ok(values);
        }

        Err(AppError::validation("VALUES 절을 찾을 수 없습니다"))
    }

    fn extract_values_array_from_query(&self, query: &str) -> Result<Vec<Value>, AppError> {
        if !query.to_ascii_uppercase().contains("UPDATE") {
            return Err(AppError::validation("UPDATE 쿼리가 아닙니다"));
        }

        if let Some(values_start) = query.to_ascii_uppercase().find("VALUES") {
            let json_part = query[values_start + 6..].trim();
            serde_json::from_str::<Vec<Value>>(json_part)
                .map_err(|_| AppError::validation("VALUES 절의 JSON 파싱에 실패했습니다"))
        } else {
            Err(AppError::validation("VALUES 절을 찾을 수 없습니다"))
        }
    }

    fn extract_where_from_query(&self, query: &str) -> Result<(String, String), AppError> {
        let q_upper = query.to_ascii_uppercase();
        let where_pos = q_upper.find("WHERE")
            .ok_or_else(|| AppError::validation("WHERE 절을 찾을 수 없습니다"))?;

        let mut i = where_pos + "WHERE".len();
        let bytes = query.as_bytes();

        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }

        // 토큰 추출
        let token_start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' {
            i += 1;
        }
        let mut token = query[token_start..i].trim().to_string();

        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }

        // '=' 스킵
        if i >= bytes.len() || bytes[i] != b'=' {
            return Err(AppError::validation("WHERE 절의 '=' 가 누락되었습니다"));
        }
        i += 1;

        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() {
            i += 1;
        }

        if i >= bytes.len() {
            return Err(AppError::validation("WHERE 값이 누락되었습니다"));
        }

        // 값 추출 (따옴표 필수)
        let quote = bytes[i];
        if quote != b'\'' && quote != b'"' {
            return Err(AppError::validation("WHERE 값은 따옴표로 감싸야 합니다"));
        }
        i += 1;

        let val_start = i;
        while i < bytes.len() && bytes[i] != quote {
            i += 1;
        }

        if i >= bytes.len() {
            return Err(AppError::validation("WHERE 값의 닫는 따옴표가 없습니다"));
        }

        let value = query[val_start..i].to_string();

        if token.is_empty() {
            token = "*".to_string(); // 전체 스캔
        }

        Ok((token, value))
    }

    fn resolve_column_index_optional(&self, token: &str) -> Option<usize> {
        if let Some(idx) = self.column_letter_to_index(token) {
            return Some(idx);
        }

        if token.eq_ignore_ascii_case("id") {
            return Some(0);
        }

        None // 전체 스캔
    }

    fn column_letter_to_index(&self, token: &str) -> Option<usize> {
        let t = token.trim();
        if t.is_empty() || !t.chars().all(|c| c.is_ascii_alphabetic()) {
            return None;
        }

        let mut idx: isize = 0;
        for ch in t.chars() {
            let v = (ch.to_ascii_uppercase() as u8 - b'A' + 1) as isize;
            idx = idx * 26 + v;
        }

        Some((idx - 1) as usize)
    }

    fn normalize_str(&self, s: &str) -> String {
        s.trim()
            .replace(['\u{200B}', '\u{200C}', '\u{200D}', '\u{FEFF}'], "")
            .to_string()
    }

    fn find_row_by_value(&self, rows: &[Value], col_idx_opt: Option<usize>, target: &str) -> Option<usize> {
        let target_norm = self.normalize_str(target);

        for (i, row) in rows.iter().enumerate() {
            if let Some(col_idx) = col_idx_opt {
                if let Some(cell_str) = self.get_cell_string(row, col_idx) {
                    if self.normalize_str(&cell_str) == target_norm {
                        return Some(i + 1); // 1-based index
                    }
                }
            } else {
                // 전체 열 스캔
                if self.row_contains_value(row, &target_norm) {
                    return Some(i + 1);
                }
            }
        }

        None
    }

    fn row_contains_value(&self, row: &Value, target_norm: &str) -> bool {
        let cells = match row.get("c").and_then(|c| c.as_array()) {
            Some(c) => c,
            None => return false,
        };

        for cell in cells {
            if let Some(s) = self.cell_to_string(cell) {
                if self.normalize_str(&s) == target_norm {
                    return true;
                }
            }
        }

        false
    }

    fn get_cell_string(&self, row: &Value, col_idx: usize) -> Option<String> {
        let cells = row.get("c")?.as_array()?;
        let cell = cells.get(col_idx)?;
        self.cell_to_string(cell)
    }

    fn cell_to_string(&self, cell: &Value) -> Option<String> {
        let v = cell.get("v")?;
        match v {
            Value::String(s) => Some(s.clone()),
            Value::Number(n) => Some(n.to_string()),
            Value::Bool(b) => Some(b.to_string()),
            _ => None,
        }
    }
}
