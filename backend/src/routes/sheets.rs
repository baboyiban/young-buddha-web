use axum::{
    extract::Query,
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};

// Public router
pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        // Read values as 2D array using Google Visualization (gviz) under the hood
        .route("/sheets/read", get(read_values))
        // Write is not implemented yet – requires OAuth token handling
        .route("/sheets/write", post(write_not_implemented))
        // Proxy Google Visualization Query Language (gviz/tq)
        .route("/sheets/query", get(query_gviz_get))
        .route("/sheets/query", post(query_gviz_post))
}

// ======== Types ========

#[derive(Debug, Deserialize)]
struct ReadParams {
    spreadsheet_id: String,
    range: String,
    #[allow(dead_code)]
    gid: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QueryGetParams {
    spreadsheet_id: String,
    tq: String,
    gid: Option<String>,
    range: Option<String>,
}

#[derive(Debug, Deserialize)]
struct QueryPostBody {
    spreadsheet_id: String,
    query: String,
    gid: Option<String>,
    range: Option<String>,
}

// Partial structures for parsing gviz JSON
#[derive(Deserialize)]
struct GvizCell {
    #[allow(dead_code)]
    f: Option<String>,
    v: Option<Value>,
}

#[derive(Deserialize)]
struct GvizRow {
    c: Option<Vec<Option<GvizCell>>>,
}

#[derive(Deserialize)]
struct GvizTable {
    #[allow(dead_code)]
    cols: Option<Vec<Value>>, // not used for read_values
    rows: Option<Vec<GvizRow>>,
}

#[derive(Deserialize)]
struct GvizResponse {
    table: Option<GvizTable>,
}

// ======== Handlers ========

// GET /api/sheets/read?spreadsheet_id=...&range=Sheet!A1:R1
async fn read_values(Query(params): Query<ReadParams>) -> impl IntoResponse {
    // Build a gviz URL that respects range and returns JSON
    let url = build_gviz_url(
        &params.spreadsheet_id,
        "select *",
        params.gid.as_deref(),
        Some(params.range.as_str()),
    );

    match reqwest::Client::new().get(&url).send().await {
        Ok(resp) => {
            if !resp.status().is_success() {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "message": "Failed to fetch from Google Sheets (gviz)",
                        "status": status.as_u16(),
                        "body": body,
                    })),
                )
                    .into_response();
            }
            let text = match resp.text().await {
                Ok(t) => t,
                Err(e) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({"error": true, "message": format!("Failed to read response: {}", e)})),
                    )
                        .into_response()
                }
            };
            let values = match extract_values_from_gviz(&text) {
                Ok(v) => v,
                Err(e) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({
                            "error": true,
                            "message": format!("Failed to parse gviz response: {}", e),
                        })),
                    )
                        .into_response()
                }
            };
            (StatusCode::OK, Json(json!({ "values": values }))).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": true, "message": format!("Request failed: {}", e)})),
        )
            .into_response(),
    }
}

// GET /api/sheets/query?spreadsheet_id=...&tq=...
async fn query_gviz_get(Query(params): Query<QueryGetParams>) -> impl IntoResponse {
    proxy_gviz(&params.spreadsheet_id, &params.tq, params.gid.as_deref(), params.range.as_deref()).await
}

// POST /api/sheets/query { spreadsheet_id, query, gid?, range? }
// Returns parsed JSON (inner object inside setResponse(...)) to match frontend QueryResponse type
async fn query_gviz_post(Json(body): Json<QueryPostBody>) -> impl IntoResponse {
    let url = build_gviz_url(
        &body.spreadsheet_id,
        &body.query,
        body.gid.as_deref(),
        body.range.as_deref(),
    );
    match reqwest::Client::new().get(&url).send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if !status.is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "message": "Failed to fetch from Google Visualization API",
                        "status": status.as_u16(),
                        "body": text,
                    })),
                )
                    .into_response();
            }
            match parse_gviz_to_value(&text) {
                Ok(value) => (StatusCode::OK, Json(value)).into_response(),
                Err(e) => (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({"error": true, "message": format!("Failed to parse gviz: {}", e)})),
                )
                    .into_response(),
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": true, "message": format!("Request failed: {}", e)})),
        )
            .into_response(),
    }
}

async fn write_not_implemented() -> impl IntoResponse {
    (
        StatusCode::NOT_IMPLEMENTED,
        Json(json!({
            "error": true,
            "code": "WRITE_UNIMPLEMENTED",
            "message": "Sheets write is not implemented yet. OAuth token storage is required.",
        })),
    )
}

// ======== Helpers ========

async fn proxy_gviz(
    spreadsheet_id: &str,
    tq: &str,
    gid: Option<&str>,
    range: Option<&str>,
) -> Response {
    let url = build_gviz_url(spreadsheet_id, tq, gid, range);
    match reqwest::Client::new().get(&url).send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if !status.is_success() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "message": "Failed to fetch from Google Visualization API",
                        "status": status.as_u16(),
                        "body": text,
                    })),
                )
                    .into_response();
            }
            let mut headers = HeaderMap::new();
            headers.insert(
                header::CONTENT_TYPE,
                HeaderValue::from_static("application/javascript; charset=utf-8"),
            );
            (StatusCode::OK, headers, text).into_response()
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(json!({"error": true, "message": format!("Request failed: {}", e)})),
        )
            .into_response(),
    }
}

pub(crate) fn build_gviz_url(spreadsheet_id: &str, tq: &str, gid: Option<&str>, range: Option<&str>) -> String {
    let base = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq",
        urlencoding::encode(spreadsheet_id)
    );
    let mut parts = vec![
        ("tqx", "out:json".to_string()),
        ("tq", urlencoding::encode(tq).to_string()),
    ];
    if let Some(g) = gid {
        parts.push(("gid", urlencoding::encode(g).to_string()));
    }
    if let Some(r) = range {
        parts.push(("range", urlencoding::encode(r).to_string()));
    }
    let query = parts
        .into_iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");
    format!("{}?{}", base, query)
}

pub(crate) fn extract_values_from_gviz(body: &str) -> Result<Vec<Vec<String>>, String> {
    // Try to extract JSON inside google.visualization.Query.setResponse(...)
    let json_str = if let Some(start_idx) =
        body.find("google.visualization.Query.setResponse(")
    {
        let after = &body[start_idx + "google.visualization.Query.setResponse(".len()..];
        // find the matching ")" near the end; gviz usually ends with ");"
        if let Some(end_idx) = after.rfind(");") {
            &after[..end_idx]
        } else {
            after
        }
    } else {
        body.trim()
    };

    let parsed: GvizResponse = serde_json::from_str(json_str)
        .map_err(|e| format!("serde_json parse error: {}", e))?;

    let mut out: Vec<Vec<String>> = Vec::new();
    let Some(table) = parsed.table else { return Ok(out) };
    let Some(rows) = table.rows else { return Ok(out) };

    for row in rows.into_iter() {
        let mut row_vals: Vec<String> = Vec::new();
        if let Some(cells) = row.c {
            for cell_opt in cells.into_iter() {
                let val = match cell_opt.and_then(|c| c.v) {
                    None => String::new(),
                    Some(Value::Null) => String::new(),
                    Some(Value::String(s)) => s,
                    Some(Value::Number(n)) => n.to_string(),
                    Some(Value::Bool(b)) => if b { "true".to_string() } else { "false".to_string() },
                    Some(other) => other.to_string(),
                };
                row_vals.push(val);
            }
        }
        out.push(row_vals);
    }
    Ok(out)
}

pub(crate) fn parse_gviz_to_value(body: &str) -> Result<Value, String> {
    // Extract inner JSON similar to extract_values_from_gviz
    let json_str = if let Some(start_idx) =
        body.find("google.visualization.Query.setResponse(")
    {
        let after = &body[start_idx + "google.visualization.Query.setResponse(".len()..];
        if let Some(end_idx) = after.rfind(");") { &after[..end_idx] } else { after }
    } else {
        body.trim()
    };
    serde_json::from_str::<Value>(json_str).map_err(|e| format!("serde_json parse error: {}", e))
}
