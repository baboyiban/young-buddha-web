use crate::types::{AppState, QueryParams, CommonParams, ApiError};
use crate::auth_tokens::{authenticate_and_get_token, refresh_user_access_token};
use crate::routes::sheets_client;
use crate::routes::sheets_parser;
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use serde_json::Value;
use std::sync::Arc;

pub struct SheetsService;

#[allow(dead_code)]
impl SheetsService {
    pub async fn query_sheet(
        state: Arc<AppState>,
        headers: HeaderMap,
        params: QueryParams,
    ) -> Result<axum::response::Response, ApiError> {
        println!("🔍 [SHEETS_QUERY] 요청 시작");
        println!("   📋 spreadsheet_id: {}", params.spreadsheet_id);
        println!("   📄 sheet_name: {}", params.sheet_name);
        println!("   🔎 query: {}", params.query);

        // 1. 인증 및 토큰 검증
        let (email, mut user_token) = authenticate_and_get_token(&headers, &state).await?;
        println!("   👤 authenticated user: {}", email);

        let client = &state.http_client;

        // 2. Visualization API 쿼리 실행
        // 페이지네이션 적용
        let mut final_query = params.query.clone();
        if let Some(limit) = params.limit {
            final_query = format!("{} LIMIT {}", final_query, limit);
        }
        if let Some(offset) = params.offset {
            final_query = format!("{} OFFSET {}", final_query, offset);
        }

        let url = format!(
            "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
            params.spreadsheet_id,
            urlencoding::encode(&final_query),
            urlencoding::encode(&params.sheet_name)
        );
        println!("   🌐 Google Sheets URL: {}", url);

        let mut resp = client.get(&url).bearer_auth(&user_token).send().await
            .map_err(|e| {
                println!("   ❌ 네트워크 요청 실패: {}", e);
                ApiError::bad_gateway("NETWORK_FAILED", format!("네트워크 요청 실패: {}", e))
            })?;

        println!("   📡 HTTP 응답 상태: {}", resp.status());

        // 401 Unauthorized이면 토큰 새로고침 후 한 번 재시도
        if resp.status() == StatusCode::UNAUTHORIZED {
            println!("   🔄 토큰 만료, 토큰 새로고침 시도");
            if let Some(new_token) = refresh_user_access_token(client, &state.db_path, &email).await {
                user_token = new_token;
                println!("   ✅ 토큰 새로고침 성공, 재요청");
                resp = client.get(&url).bearer_auth(&user_token).send().await
                    .map_err(|e| {
                        println!("   ❌ 재요청 실패: {}", e);
                        ApiError::bad_gateway("NETWORK_FAILED", format!("네트워크 요청 실패: {}", e))
                    })?;
                println!("   📡 재요청 응답 상태: {}", resp.status());
            } else {
                println!("   ❌ 토큰 새로고침 실패");
            }
        }

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            println!("   ❌ Google Sheets API 오류 - 상태: {}, 응답: {}", status, body);
            if status == StatusCode::UNAUTHORIZED {
                return Err(ApiError::unauthorized("Google 인증이 만료되었습니다. 다시 로그인해주세요."));
            }
            return Err(ApiError::bad_gateway("SHEETS_API_FAILED",
                format!("시트 쿼리 실패: {}", status)));
        }

        let text = resp.text().await.unwrap_or_default();
        println!("   📄 Google Sheets 응답 길이: {} bytes", text.len());
        println!("   📄 응답 시작 부분: {}", &text.chars().take(200).collect::<String>());

        let result = sheets_parser::parse_gviz_json(&text)
            .map_err(|e| {
                println!("   ❌ JSON 파싱 오류: {:?}", e);
                e
            })?;

        println!("   ✅ 쿼리 성공, 결과 반환");
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

        // 2. 전체 시트 데이터 조회(GViz rows)
        let rows_all = sheets_client::fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await?;

        // 3. WHERE 파싱 + VALUES 파싱
        let (where_token, where_value) = Self::extract_where_from_query(&params.query)?;
        let update_data = Self::extract_values_array_from_query(&params.query)?;

        // 4. 열 인덱스 해석(열문자: A, B, ... AA / id는 0번 컬럼으로 간주 / 그 외 토큰은 전체 스캔)
        let col_idx_opt = Self::resolve_column_index_optional(&where_token);

        // 5. 대상 행 찾기(열 지정 시 해당 열만, 아니면 전체 열 스캔)
        let target_row_index = Self::find_row_by_value(&rows_all, col_idx_opt, &where_value)
            .ok_or_else(|| ApiError::not_found("지정된 조건에 해당하는 행을 찾을 수 없습니다"))?;

        // 6. 행 업데이트(1-based index)
        let result = sheets_client::update_row_in_sheet(
            &client,
            &params.spreadsheet_id,
            &params.sheet_name,
            target_row_index,
            &update_data,
            &user_token
        ).await?;

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

        // 2. 전체 시트 데이터 조회(GViz rows)
        let rows_all = sheets_client::fetch_all_sheet_data(&client, &params.spreadsheet_id, &params.sheet_name, &user_token).await?;

        // 3. WHERE 파싱
        let (where_token, where_value) = Self::extract_where_from_query(&params.query)?;

        // 4. 열 인덱스 해석(열문자/ID/없으면 전체 스캔)
        let col_idx_opt = Self::resolve_column_index_optional(&where_token);

        // 5. 대상 행 찾기
        let target_row_index = Self::find_row_by_value(&rows_all, col_idx_opt, &where_value)
            .ok_or_else(|| ApiError::not_found("지정된 조건에 해당하는 행을 찾을 수 없습니다"))?;

        // 6. 행 삭제(1-based index)
        let result = sheets_client::delete_row_from_sheet(
            &client,
            &params.spreadsheet_id,
            &params.sheet_name,
            target_row_index,
            &user_token
        ).await?;

        Ok((StatusCode::OK, Json(result)).into_response())
    }

    // ================= 헬퍼 함수들 =================

    // INSERT [JSON_ARRAY] 형태의 쿼리 파싱
    fn extract_insert_data_from_query(query: &str) -> Result<Vec<Value>, ApiError> {
        if !query.to_ascii_uppercase().starts_with("INSERT") {
            return Err(ApiError::bad_request("INVALID_QUERY", "INSERT 쿼리가 아닙니다"));
        }
        let json_part = query[6..].trim();
        if let Ok(parsed) = serde_json::from_str::<Vec<Value>>(json_part) {
            Ok(parsed)
        } else {
            // 실패하면 기존 VALUES 구문 fallback
            if let Some(values_start) = query.to_ascii_uppercase().find("VALUES") {
                let values_part = &query[values_start + 6..];
                let values_part = values_part.trim().trim_matches('(').trim_matches(')');

                let values: Vec<Value> = values_part
                    .split(',')
                    .map(|v| {
                        let v = v.trim().trim_matches('\'').trim_matches('"');
                        if v.parse::<i64>().is_ok() {
                            Value::Number(v.parse::<i64>().unwrap().into())
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
    }

    // UPDATE 쿼리에서 VALUES [ ... ] JSON 배열만 추출
    fn extract_values_array_from_query(query: &str) -> Result<Vec<Value>, ApiError> {
        if !query.to_ascii_uppercase().contains("UPDATE") {
            return Err(ApiError::bad_request("INVALID_QUERY", "UPDATE 쿼리가 아닙니다"));
        }
        if let Some(values_start) = query.to_ascii_uppercase().find("VALUES") {
            let json_part = query[values_start + 6..].trim();
            serde_json::from_str::<Vec<Value>>(json_part)
                .map_err(|_| ApiError::bad_request("INVALID_QUERY", "VALUES 절의 JSON 파싱에 실패했습니다"))
        } else {
            Err(ApiError::bad_request("INVALID_QUERY", "VALUES 절을 찾을 수 없습니다"))
        }
    }

    // WHERE <토큰> = '값' 또는 "값" 파싱(토큰은 어떤 문자든 허용: 공백/ '=' 전까지)
    fn extract_where_from_query(query: &str) -> Result<(String, String), ApiError> {
        let q_upper = query.to_ascii_uppercase();
        let where_pos = q_upper.find("WHERE")
            .ok_or_else(|| ApiError::bad_request("INVALID_QUERY", "WHERE 절을 찾을 수 없습니다"))?;
        // WHERE 다음 부분
        let mut i = where_pos + "WHERE".len();
        let bytes = query.as_bytes();
        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() { i += 1; }
        // 토큰 추출: 공백 또는 '=' 전까지
        let token_start = i;
        while i < bytes.len() && !bytes[i].is_ascii_whitespace() && bytes[i] != b'=' { i += 1; }
        let mut token = query[token_start..i].trim().to_string();
        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() { i += 1; }
        // '=' 스킵
        if i >= bytes.len() || bytes[i] != b'=' {
            return Err(ApiError::bad_request("INVALID_QUERY", "WHERE 절의 '=' 가 누락되었습니다"));
        }
        i += 1;
        // 공백 스킵
        while i < bytes.len() && bytes[i].is_ascii_whitespace() { i += 1; }
        if i >= bytes.len() {
            return Err(ApiError::bad_request("INVALID_QUERY", "WHERE 값이 누락되었습니다"));
        }
        // 값은 따옴표 필수로 가정
        let quote = bytes[i];
        if quote != b'\'' && quote != b'"' {
            return Err(ApiError::bad_request("INVALID_QUERY", "WHERE 값은 따옴표로 감싸야 합니다"));
        }
        i += 1;
        let val_start = i;
        while i < bytes.len() && bytes[i] != quote { i += 1; }
        if i >= bytes.len() {
            return Err(ApiError::bad_request("INVALID_QUERY", "WHERE 값의 닫는 따옴표가 없습니다"));
        }
        let value = query[val_start..i].to_string();

        if token.is_empty() {
            token = "*".to_string(); // 토큰이 비면 전체 스캔 의미로 취급
        }
        Ok((token, value))
    }

    // 열 인덱스 해석: 열문자(A..AA..) => Some(idx), 'id' => Some(0), 그 외 => None(전체 스캔)
    fn resolve_column_index_optional(token: &str) -> Option<usize> {
        if let Some(idx) = Self::column_letter_to_index(token) {
            return Some(idx);
        }
        if token.eq_ignore_ascii_case("id") {
            return Some(0);
        }
        None // 헤더명을 알 수 없으므로 전체 스캔
    }

    // A->0, Z->25, AA->26 ...
    fn column_letter_to_index(token: &str) -> Option<usize> {
        let t = token.trim();
        if t.is_empty() { return None; }
        // 열문자는 ASCII 알파벳으로만 구성
        if !t.chars().all(|c| c.is_ascii_alphabetic()) {
            return None;
        }
        let mut idx: isize = 0;
        for ch in t.chars() {
            let v = (ch.to_ascii_uppercase() as u8 - b'A' + 1) as isize;
            idx = idx * 26 + v;
        }
        Some((idx - 1) as usize)
    }

    // 문자열 정규화: trim + 제로폭 제거
    fn normalize_str(s: &str) -> String {
        s.trim()
            .replace('\u{200B}', "")
            .replace('\u{200C}', "")
            .replace('\u{200D}', "")
            .replace('\u{FEFF}', "")
            .to_string()
    }

    // GViz rows에서 특정 열만 또는 전체 열에서 target과 일치하는 1-based 행 번호 반환
    fn find_row_by_value(rows: &[Value], col_idx_opt: Option<usize>, target: &str) -> Option<usize> {
        let target_norm = Self::normalize_str(target);
        for (i, row) in rows.iter().enumerate() {
            if let Some(col_idx) = col_idx_opt {
                if let Some(cell_str) = Self::get_cell_string(row, col_idx) {
                    if Self::normalize_str(&cell_str) == target_norm {
                        return Some(i + 1); // Sheets API는 1-based
                    }
                }
            } else {
                // 전체 열 스캔
                if Self::row_contains_value(row, &target_norm) {
                    return Some(i + 1);
                }
            }
        }
        None
    }

    fn row_contains_value(row: &Value, target_norm: &str) -> bool {
        let cells = match row.get("c").and_then(|c| c.as_array()) {
            Some(c) => c,
            None => return false,
        };
        for cell in cells {
            if let Some(s) = Self::cell_to_string(cell) {
                if Self::normalize_str(&s) == target_norm {
                    return true;
                }
            }
        }
        false
    }

    fn get_cell_string(row: &Value, col_idx: usize) -> Option<String> {
        let cells = row.get("c")?.as_array()?;
        let cell = cells.get(col_idx)?;
        Self::cell_to_string(cell)
    }

    fn cell_to_string(cell: &Value) -> Option<String> {
        let v = cell.get("v")?;
        if let Some(s) = v.as_str() {
            return Some(s.to_string());
        }
        if let Some(n) = v.as_i64() {
            return Some(n.to_string());
        }
        if let Some(f) = v.as_f64() {
            return Some(f.to_string());
        }
        if let Some(b) = v.as_bool() {
            return Some(b.to_string());
        }
        None
    }

    // ================= 이하 레거시(호환용) =================
    // 기존 코드가 참조할 수 있어 남겨두지만, 현재 경로에서는 사용하지 않습니다.

    fn extract_update_data_from_query(_query: &str) -> Result<(String, Vec<Value>), ApiError> {
        Err(ApiError::bad_request("INVALID_QUERY", "레거시 UPDATE 파서는 사용되지 않습니다"))
    }

    fn extract_id_from_where_query(_query: &str) -> Result<String, ApiError> {
        Err(ApiError::bad_request("INVALID_QUERY", "레거시 id 전용 WHERE 파서는 사용되지 않습니다"))
    }

    fn find_row_by_id(_rows: &[Value], _target_id: &str) -> Result<usize, ApiError> {
        Err(ApiError::bad_request("INVALID_QUERY", "레거시 id 전용 검색은 사용되지 않습니다"))
    }

    fn get_row_id(row: &Value) -> Option<String> {
        row.get("c")
            .and_then(|c| c.as_array())
            .and_then(|cells| cells.get(0))
            .and_then(|cell| cell.get("v"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    }
}
