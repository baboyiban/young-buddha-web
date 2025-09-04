use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateRequest {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub request_date: String,
    pub absent_date: Option<String>,
    pub partial_schedule: Option<String>,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DatabaseRow {
    pub id: i64,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub request_date: String,
    pub absent_date: Option<String>,
    pub partial_schedule: Option<String>,
    pub reason: Option<String>,
}
