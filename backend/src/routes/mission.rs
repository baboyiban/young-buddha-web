use axum::{extract::Query, http::StatusCode, response::Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

#[derive(Debug, Deserialize)]
struct MissionParams {
    spreadsheet_id: Option<String>,
    range: Option<String>,
    gid: Option<String>,
}

pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new().route("/mission", axum::routing::get(get_mission_data))
}

// Reads one row from Google Sheets via GViz and returns string[]
async fn get_mission_data(Query(params): Query<MissionParams>) -> Result<Json<Value>, StatusCode> {
    let spreadsheet_id = params
        .spreadsheet_id
        .or_else(|| std::env::var("MISSION_SPREADSHEET_ID").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;
    let range = params
        .range
        .or_else(|| std::env::var("MISSION_RANGE").ok())
        .ok_or(StatusCode::BAD_REQUEST)?;

    let url = super::sheets::build_gviz_url(
        &spreadsheet_id,
        "select *",
        params.gid.as_deref(),
        Some(range.as_str()),
    );

    let resp = reqwest::Client::new()
        .get(url)
        .send()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    if !resp.status().is_success() {
        return Err(StatusCode::BAD_GATEWAY);
    }
    let text = resp.text().await.map_err(|_| StatusCode::BAD_GATEWAY)?;
    let values = super::sheets::extract_values_from_gviz(&text)
        .map_err(|_| StatusCode::BAD_GATEWAY)?;

    // Return the first row if present; otherwise empty array
    let row = values.into_iter().next().unwrap_or_default();
    Ok(Json(json!(row)))
}