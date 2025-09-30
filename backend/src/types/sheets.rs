use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub spreadsheet_id: String,
    pub gid: String,
    pub query: String,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct CommonParams {
    pub spreadsheet_id: String,
    pub gid: String,
    pub query: String,
}
