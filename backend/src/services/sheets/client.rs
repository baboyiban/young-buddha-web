use reqwest::Client;
use serde_json::{json, Value};
use crate::types::AppError;

pub struct SheetsClient {
    client: Client,
}

impl SheetsClient {
    pub fn new(client: Client) -> Self {
        Self { client }
    }

    pub async fn query_visualization_api(
        &self,
        spreadsheet_id: &str,
        sheet_name: &str,
        query: &str,
        access_token: &str,
    ) -> Result<String, AppError> {
        // Try with authentication first
        let url = format!(
            "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
            spreadsheet_id,
            urlencoding::encode(query),
            urlencoding::encode(sheet_name)
        );

        tracing::debug!("Querying Sheets Visualization API: {}", url);

        let resp = self.client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if resp.status().is_success() {
            return Ok(resp.text().await?);
        }

        // If authentication fails, try without authentication (for public sheets)
        tracing::debug!("Authentication failed, trying without auth for public sheet");
        let resp_public = self.client
            .get(&url)
            .send()
            .await?;

        if !resp_public.status().is_success() {
            let status = resp_public.status();
            let body = resp_public.text().await.unwrap_or_default();
            tracing::error!("Sheets API error: status={}, body={}", status, body);
            return Err(AppError::external_api(format!("시트 쿼리 실패: {}", status)));
        }

        Ok(resp_public.text().await?)
    }

    pub async fn append_row(
        &self,
        spreadsheet_id: &str,
        sheet_name: &str,
        values: &[Value],
        access_token: &str,
    ) -> Result<(), AppError> {
        let range = format!("{}!A:Z", sheet_name);
        let string_values: Vec<String> = values.iter()
            .map(|v| self.value_to_string(v))
            .collect();

        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS",
            urlencoding::encode(spreadsheet_id),
            urlencoding::encode(&range)
        );

        let body = json!({
            "values": [string_values],
            "majorDimension": "ROWS"
        });

        let resp = self.client
            .post(&url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::external_api(format!("Sheets append 실패: {} - {}", status, body)));
        }

        Ok(())
    }

    pub async fn update_row(
        &self,
        spreadsheet_id: &str,
        sheet_name: &str,
        row_index: usize,
        values: &[Value],
        access_token: &str,
    ) -> Result<(), AppError> {
        let end_col = self.number_to_column_letters(values.len() as u32);
        let range = format!("{}!A{}:{}{}", sheet_name, row_index, end_col, row_index);

        let string_values: Vec<String> = values.iter()
            .map(|v| self.value_to_string(v))
            .collect();

        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?valueInputOption=RAW",
            urlencoding::encode(spreadsheet_id),
            urlencoding::encode(&range)
        );

        let body = json!({
            "values": [string_values],
            "majorDimension": "ROWS"
        });

        let resp = self.client
            .put(&url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::external_api(format!("Sheets update 실패: {} - {}", status, body)));
        }

        Ok(())
    }

    pub async fn delete_row(
        &self,
        spreadsheet_id: &str,
        sheet_id: u32,
        row_index: usize,
        access_token: &str,
    ) -> Result<(), AppError> {
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}:batchUpdate",
            urlencoding::encode(spreadsheet_id)
        );

        let body = json!({
            "requests": [{
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": row_index,
                        "endIndex": row_index + 1
                    }
                }
            }]
        });

        let resp = self.client
            .post(&url)
            .bearer_auth(access_token)
            .json(&body)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::external_api(format!("Sheets delete 실패: {} - {}", status, body)));
        }

        Ok(())
    }

    pub async fn get_sheet_id_by_name(
        &self,
        spreadsheet_id: &str,
        sheet_name: &str,
        access_token: &str,
    ) -> Result<u32, AppError> {
        let url = format!(
            "https://sheets.googleapis.com/v4/spreadsheets/{}",
            urlencoding::encode(spreadsheet_id)
        );

        let resp = self.client
            .get(&url)
            .bearer_auth(access_token)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::external_api(format!("스프레드시트 메타데이터 조회 실패: {} - {}", status, body)));
        }

        let spreadsheet_data: Value = resp.json().await?;
        self.find_sheet_id_in_spreadsheet(&spreadsheet_data, sheet_name)
            .ok_or_else(|| AppError::not_found(format!("시트 '{}'를 찾을 수 없습니다", sheet_name)))
    }

    fn value_to_string(&self, value: &Value) -> String {
        match value {
            Value::String(s) => s.clone(),
            Value::Number(n) => n.to_string(),
            Value::Bool(b) => b.to_string(),
            Value::Null => String::new(),
            _ => String::new(),
        }
    }

    fn number_to_column_letters(&self, mut n: u32) -> String {
        if n == 0 {
            return "A".to_string();
        }
        let mut s = String::new();
        while n > 0 {
            let rem = (n - 1) % 26;
            s.insert(0, (b'A' + rem as u8) as char);
            n = (n - 1) / 26;
        }
        s
    }

    fn find_sheet_id_in_spreadsheet(&self, spreadsheet_data: &Value, sheet_name: &str) -> Option<u32> {
        let sheets = spreadsheet_data.get("sheets")?.as_array()?;
        for sheet in sheets {
            let properties = sheet.get("properties")?;
            let title = properties.get("title")?.as_str()?;
            let sheet_id = properties.get("sheetId")?.as_u64()?;
            if title == sheet_name {
                return Some(sheet_id as u32);
            }
        }
        None
    }
}
