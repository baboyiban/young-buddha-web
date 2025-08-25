#![allow(dead_code)]
use serde::Deserialize;

// Visualization API Query Language 기반 쿼리 핸들러
#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub spreadsheet_id: String,
    pub sheet_name: String,
    // allow alias "read" for backward/forward compatibility when renaming
    #[serde(alias = "read")]
    pub query: String,
    #[serde(default = "default_limit")]
    pub limit: Option<u32>,
    #[serde(default = "default_offset")]
    pub offset: Option<u32>,
}

// 공통 파라미터 (CRUD 모두 동일한 형식: spreadsheet_id, sheet_name, query)
#[derive(Debug, Deserialize)]
pub struct CommonParams {
    pub spreadsheet_id: String,
    pub sheet_name: String,
    pub query: String,
}

// 기본값 함수들
fn default_limit() -> Option<u32> {
    None
}

fn default_offset() -> Option<u32> {
    None
}

// JWT Claims for sheets
#[derive(Deserialize)]
pub struct SheetsClaims {
    pub email: Option<String>,
}
