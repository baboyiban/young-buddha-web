use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use once_cell::sync::OnceCell;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use std::sync::Arc;
use crate::state::AppState;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use rusqlite::Connection;

fn sheets_api_only() -> bool {
    match std::env::var("SHEETS_API_ONLY") {
        Ok(v) => matches!(v.as_str(), "1" | "true" | "TRUE" | "True"),
        Err(_) => false,
    }
}

// Public router (state-aware)
pub fn router() -> Router<Arc<AppState>> {
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
async fn read_values(State(state): State<Arc<AppState>>, headers: HeaderMap, Query(params): Query<ReadParams>) -> impl IntoResponse {
    let client = reqwest::Client::new();

    // If user is logged in and we have a Google access token stored, try Sheets API on behalf of user first
    if let Some(email) = get_email_from_jwt_cookie(&headers, state.jwt_secret.as_deref()) {
        if let Some(user_token) = lookup_user_token(&state.db_path, &email).await {
            match sheets_api_read_with_token(&client, &params.spreadsheet_id, &params.range, &user_token).await {
            Ok(values) => {
                return (StatusCode::OK, Json(json!({ "values": values }))).into_response();
            }
            Err(e) => {
                if sheets_api_only() {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({
                            "error": true,
                            "code": "USER_SHEETS_API_FAILED",
                            "message": format!("사용자 토큰으로 Sheets API 실패: {}", e),
                            "hint": "로그인 토큰 만료 시 재로그인 필요. 또는 서비스 계정 설정으로 서버-투-서버 접근을 사용하세요.",
                        })),
                    ).into_response();
                }
            }
        }
        }
    }

    // 1) Try Google Sheets API with service account (private sheet support)
    match sheets_api_read(&client, &params.spreadsheet_id, &params.range).await {
        Ok(Some(values)) => {
            return (StatusCode::OK, Json(json!({ "values": values }))).into_response();
        }
        Ok(None) => {
            // Service account not configured
            if sheets_api_only() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "code": "SHEETS_API_NOT_CONFIGURED",
                        "message": "Sheets API v4 전용 모드입니다. 서비스 계정이 설정되지 않았습니다.",
                        "hint": "GOOGLE_SERVICE_ACCOUNT_JSON 또는 GOOGLE_SERVICE_ACCOUNT_JSON_PATH를 설정하고, 해당 서비스 계정 이메일로 스프레드시트를 공유하세요.",
                    })),
                ).into_response();
            }
            // else: fall back to gviz
        }
        Err(e) => {
            // If API-only, return error immediately
            if sheets_api_only() {
                return (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "code": "SHEETS_API_FAILED",
                        "message": format!("Sheets API v4 호출 실패: {}", e),
                        "hint": "서비스 계정 JSON과 시트 공유 상태, range/시트명 표기를 확인하세요.",
                    })),
                ).into_response();
            }
            // Include partial info and continue to gviz fallback
            tracing::warn!(target = "sheets", "Sheets API read failed, falling back to gviz: {}", e);
        }
    }

    // Attempt 1: Use range as-is (including potential `Sheet!A1:B2`), no sheet split
    let url_as_is = build_gviz_url_no_split(
        &params.spreadsheet_id,
        "select *",
        params.gid.as_deref(),
        Some(params.range.as_str()),
    );

    match client.get(&url_as_is).send().await {
        Ok(resp) => {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.is_success() {
                match extract_values_from_gviz(&text) {
                    Ok(values) => return (StatusCode::OK, Json(json!({ "values": values }))).into_response(),
                    Err(parse_err) => {
                        // Fall through to attempt 2, but keep details
                        let url_split = build_gviz_url(
                            &params.spreadsheet_id,
                            "select *",
                            params.gid.as_deref(),
                            Some(params.range.as_str()),
                        );
                        match client.get(&url_split).send().await {
                            Ok(resp2) => {
                                let status2 = resp2.status();
                                let text2 = resp2.text().await.unwrap_or_default();
                                if status2.is_success() {
                                    match extract_values_from_gviz(&text2) {
                                        Ok(values2) => return (StatusCode::OK, Json(json!({ "values": values2 }))).into_response(),
                                        Err(parse_err2) => {
                                            return (
                                                StatusCode::BAD_GATEWAY,
                                                Json(json!({
                                                    "error": true,
                                                    "message": "Failed to parse gviz response (both attempts)",
                                                    "attempts": [
                                                        {"url": url_as_is, "status": status.as_u16(), "parse_error": parse_err},
                                                        {"url": url_split, "status": status2.as_u16(), "parse_error": parse_err2}
                                                    ]
                                                })),
                                            ).into_response();
                                        }
                                    }
                                } else {
                                    return (
                                        StatusCode::BAD_GATEWAY,
                                        Json(json!({
                                            "error": true,
                                            "message": "Failed to fetch from Google Sheets (attempt 2)",
                                            "hint": "시트가 비공개라면 서비스 계정 설정(GOOGLE_SERVICE_ACCOUNT_JSON[_PATH])과 스프레드시트 공유를 확인하세요. 공개 시트면 링크 접근 허용인지 확인.",
                                            "attempts": [
                                                {"url": url_as_is, "status": status.as_u16(), "body": truncate(&text, 400)},
                                                {"url": url_split, "status": status2.as_u16(), "body": truncate(&text2, 400)}
                                            ]
                                        })),
                                    ).into_response();
                                }
                            }
                            Err(e2) => {
                                return (
                                    StatusCode::BAD_GATEWAY,
                                    Json(json!({
                                        "error": true,
                                        "message": "Request to Google Sheets failed (attempt 2)",
                                        "attempts": [
                                            {"url": url_as_is, "status": status.as_u16(), "body": truncate(&text, 400)},
                                            {"url": url_split, "network_error": e2.to_string()}
                                        ]
                                    })),
                                ).into_response();
                            }
                        }
                    }
                }
            } else {
                // Attempt 2: split sheet/range
                let url_split = build_gviz_url(
                    &params.spreadsheet_id,
                    "select *",
                    params.gid.as_deref(),
                    Some(params.range.as_str()),
                );
                match client.get(&url_split).send().await {
                    Ok(resp2) => {
                        let status2 = resp2.status();
                        let text2 = resp2.text().await.unwrap_or_default();
                        if status2.is_success() {
                            match extract_values_from_gviz(&text2) {
                                Ok(values2) => (StatusCode::OK, Json(json!({ "values": values2 }))).into_response(),
                                Err(parse_err2) => (
                                    StatusCode::BAD_GATEWAY,
                                    Json(json!({
                                        "error": true,
                                        "message": "Failed to parse gviz response (attempt 2)",
                                        "attempts": [
                                            {"url": url_as_is, "status": status.as_u16(), "body": truncate(&text, 400)},
                                            {"url": url_split, "status": status2.as_u16(), "parse_error": parse_err2}
                                        ]
                                    })),
                                ).into_response(),
                            }
                        } else {
                            (
                                StatusCode::BAD_GATEWAY,
                                Json(json!({
                                    "error": true,
                                    "message": "Failed to fetch from Google Sheets (both attempts)",
                                        "hint": "비공개 시트 접근에는 서비스 계정 설정이 필요합니다. .env(.example) 참고 후 GOOGLE_SERVICE_ACCOUNT_JSON 또는 _PATH를 설정하고 해당 서비스 계정 이메일로 시트를 공유하세요.",
                                    "attempts": [
                                        {"url": url_as_is, "status": status.as_u16(), "body": truncate(&text, 400)},
                                        {"url": url_split, "status": status2.as_u16(), "body": truncate(&text2, 400)}
                                    ]
                                })),
                            ).into_response()
                        }
                    }
                    Err(e2) => (
                        StatusCode::BAD_GATEWAY,
                        Json(json!({
                            "error": true,
                            "message": "Request to Google Sheets failed (attempt 2)",
                                        "hint": "사설 시트면 서비스 계정 설정이 필요합니다. 공개 시트면 네트워크/권한 상태를 확인하세요.",
                            "attempts": [
                                {"url": url_as_is, "status": status.as_u16(), "body": truncate(&text, 400)},
                                {"url": url_split, "network_error": e2.to_string()}
                            ]
                        })),
                    ).into_response(),
                }
            }
        }
        Err(e) => {
            // Attempt 2 immediately if attempt 1 had a network error
            let url_split = build_gviz_url(
                &params.spreadsheet_id,
                "select *",
                params.gid.as_deref(),
                Some(params.range.as_str()),
            );
            match client.get(&url_split).send().await {
                Ok(resp2) => {
                    let status2 = resp2.status();
                    let text2 = resp2.text().await.unwrap_or_default();
                    if status2.is_success() {
                        match extract_values_from_gviz(&text2) {
                            Ok(values2) => (StatusCode::OK, Json(json!({ "values": values2 }))).into_response(),
                            Err(parse_err2) => (
                                StatusCode::BAD_GATEWAY,
                                Json(json!({
                                    "error": true,
                                    "message": "Failed to parse gviz response (attempt 2)",
                                        "hint": "서비스 계정 미설정으로 gviz 폴백 사용 중일 수 있습니다. 비공개 시트는 gviz가 401을 반환합니다.",
                                    "attempts": [
                                        {"url": url_as_is, "network_error": e.to_string()},
                                        {"url": url_split, "status": status2.as_u16(), "parse_error": parse_err2}
                                    ]
                                })),
                            ).into_response(),
                        }
                    } else {
                        (
                            StatusCode::BAD_GATEWAY,
                            Json(json!({
                                "error": true,
                                "message": "Failed to fetch from Google Sheets (both attempts)",
                                "hint": "비공개 시트면 서비스 계정을 설정하고 스프레드시트를 공유하세요. 공개 시트면 접근 권한/링크 설정을 점검.",
                                "attempts": [
                                    {"url": url_as_is, "network_error": e.to_string()},
                                    {"url": url_split, "status": status2.as_u16(), "body": truncate(&text2, 400)}
                                ]
                            })),
                        ).into_response()
                    }
                }
                Err(e2) => (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "error": true,
                        "message": "Requests to Google Sheets failed (both attempts)",
                        "hint": "서비스 계정 미설정/권한 문제일 수 있습니다. .env 설정과 공유 상태를 확인하세요.",
                        "attempts": [
                            {"url": url_as_is, "network_error": e.to_string()},
                            {"url": url_split, "network_error": e2.to_string()}
                        ]
                    })),
                ).into_response(),
            }
        }
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

    // If range contains a sheet name like "Sheet1!A1:B2", split into sheet and range for gviz.
    let (sheet_param, range_param): (Option<&str>, Option<&str>) = match range {
        Some(r) => {
            if let Some(excl_idx) = r.find('!') {
                let (sheet, rest) = r.split_at(excl_idx);
                let only_range = &rest[1..]; // skip '!'
                (Some(sheet), Some(only_range))
            } else {
                (None, Some(r))
            }
        }
        None => (None, None),
    };

    let mut parts = vec![
        ("tqx", "out:json".to_string()),
        ("tq", urlencoding::encode(tq).to_string()),
    ];
    if let Some(g) = gid {
        parts.push(("gid", urlencoding::encode(g).to_string()));
    }
    if let Some(s) = sheet_param {
        parts.push(("sheet", urlencoding::encode(s).to_string()));
    }
    if let Some(r) = range_param {
        parts.push(("range", urlencoding::encode(r).to_string()));
    }
    let query = parts
        .into_iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");
    format!("{}?{}", base, query)
}

// Variant that keeps the range as-is (including potential "Sheet!A1:B2") and does not add a separate `sheet` param.
pub(crate) fn build_gviz_url_no_split(
    spreadsheet_id: &str,
    tq: &str,
    gid: Option<&str>,
    range: Option<&str>,
) -> String {
    let base = format!(
        "https://docs.google.com/spreadsheets/d/{}/gviz/tq",
        urlencoding::encode(spreadsheet_id)
    );
    let mut parts = vec![
        ("tqx", "out:json".to_string()),
        ("tq", urlencoding::encode(tq).to_string()),
    ];
    if let Some(g) = gid { parts.push(("gid", urlencoding::encode(g).to_string())); }
    if let Some(r) = range { parts.push(("range", urlencoding::encode(r).to_string())); }
    let query = parts.into_iter().map(|(k,v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&");
    format!("{}?{}", base, query)
}

// Utility: truncate long strings for error payloads
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len { s.to_string() } else { format!("{}…", &s[..max_len]) }
}

// ======== Google Sheets API (service account) ========

// Environment variable containing the service account JSON key content or path
// GOOGLE_SERVICE_ACCOUNT_JSON: inline JSON
// or GOOGLE_SERVICE_ACCOUNT_JSON_PATH: path to JSON file
static SA_KEY: OnceCell<Option<ServiceAccountKey>> = OnceCell::new();

#[derive(Debug, Deserialize, Clone)]
struct ServiceAccountKey {
    #[allow(dead_code)]
    #[serde(rename = "type")] type_field: String,
    #[allow(dead_code)]
    project_id: String,
    private_key_id: String,
    private_key: String,
    client_email: String,
    #[allow(dead_code)]
    client_id: String,
    // other fields ignored
}

#[derive(Serialize)]
struct JwtHeader {
    alg: &'static str,
    typ: &'static str,
    kid: Option<String>,
}

#[derive(Serialize)]
struct JwtClaim {
    iss: String,
    scope: String,
    aud: &'static str,
    exp: u64,
    iat: u64,
}

async fn sheets_api_read(client: &reqwest::Client, spreadsheet_id: &str, range: &str) -> anyhow::Result<Option<Vec<Vec<String>>>> {
    let sa = match get_service_account_key().await? {
        Some(k) => k,
        None => return Ok(None),
    };
    let token = get_service_account_token(client, &sa, &[
        "https://www.googleapis.com/auth/spreadsheets.readonly",
    ]).await?;

    // Call Sheets API v4: GET https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}?majorDimension=ROWS
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?majorDimension=ROWS",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(range)
    );
    let resp = client
        .get(&url)
        .bearer_auth(&token)
        .send()
        .await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("Sheets API error {}: {}", status, body);
    }
    let v: Value = resp.json().await?;
    // Expect { values: [[...], ...] }
    let values = v.get("values").and_then(|vv| vv.as_array()).cloned().unwrap_or_default();
    let out = values
        .into_iter()
        .map(|row| row
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|cell| match cell {
                Value::String(s) => s,
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => if b { "true".to_string() } else { "false".to_string() },
                Value::Null => String::new(),
                other => other.to_string(),
            })
            .collect::<Vec<String>>()
        )
        .collect::<Vec<Vec<String>>>();
    Ok(Some(out))
}

async fn get_service_account_key() -> anyhow::Result<Option<ServiceAccountKey>> {
    if let Some(cached) = SA_KEY.get() {
        return Ok(cached.clone());
    }
    // Try inline JSON first
    if let Ok(inline) = std::env::var("GOOGLE_SERVICE_ACCOUNT_JSON") {
        let key: ServiceAccountKey = serde_json::from_str(&inline)?;
    SA_KEY.set(Some(key.clone())).ok();
        return Ok(Some(key));
    }
    // Try path
    if let Ok(path) = std::env::var("GOOGLE_SERVICE_ACCOUNT_JSON_PATH") {
        let data = tokio::fs::read_to_string(&path).await?;
        let key: ServiceAccountKey = serde_json::from_str(&data)?;
        SA_KEY.set(Some(key.clone())).ok();
        return Ok(Some(key));
    }
    SA_KEY.set(None).ok();
    Ok(None)
}

async fn get_service_account_token(client: &reqwest::Client, sa: &ServiceAccountKey, scopes: &[&str]) -> anyhow::Result<String> {
    // Build JWT assertion (RFC 7523) for Google OAuth 2.0
    let iat = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
    let exp = iat + 3600; // 1 hour
    let header = JwtHeader { alg: "RS256", typ: "JWT", kid: Some(sa.private_key_id.clone()) };
    let claim = JwtClaim {
        iss: sa.client_email.clone(),
        scope: scopes.join(" "),
        aud: "https://oauth2.googleapis.com/token",
        exp,
        iat,
    };
    let header_b64 = base64_url_json(&header)?;
    let claim_b64 = base64_url_json(&claim)?;
    let signing_input = format!("{}.{}", header_b64, claim_b64);
    let signature = rsa_sha256_sign(&sa.private_key, signing_input.as_bytes())?;
    let assertion = format!("{}.{}", signing_input, signature);

    #[derive(Deserialize)]
    struct TokenResp { access_token: String, #[allow(dead_code)] token_type: String, #[allow(dead_code)] expires_in: u64 }

    let form = [
        ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
        ("assertion", assertion.as_str()),
    ];
    let resp = client
        .post("https://oauth2.googleapis.com/token")
        .form(&form)
        .send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("Token exchange failed {}: {}", status, body);
    }
    let tr: TokenResp = resp.json().await?;
    Ok(tr.access_token)
}

fn base64_url_json<T: Serialize>(v: &T) -> anyhow::Result<String> {
    let s = serde_json::to_string(v)?;
    Ok(base64_url_nopad(s.as_bytes()))
}

fn base64_url_nopad(bytes: &[u8]) -> String {
    let mut b = B64.encode(bytes);
    // Convert to URL-safe base64 and strip padding
    b = b.replace('+', "-").replace('/', "_").trim_end_matches('=').to_string();
    b
}

fn rsa_sha256_sign(pem_private_key: &str, data: &[u8]) -> anyhow::Result<String> {
    // Use ring to sign with RSA SHA-256
    use ring::rand::SystemRandom;
    use ring::signature::{RsaKeyPair, RSA_PKCS1_SHA256};

    // Private key is in PEM with header/footer; decode to DER
    let der = pem_to_der(pem_private_key)?;
    let key_pair = RsaKeyPair::from_der(&der).map_err(|_| anyhow::anyhow!("Invalid RSA private key"))?;
    let rng = SystemRandom::new();
    let mut sig = vec![0u8; key_pair.public().modulus_len()];
    key_pair.sign(&RSA_PKCS1_SHA256, &rng, data, &mut sig)
        .map_err(|_| anyhow::anyhow!("RSA sign failed"))?;
    Ok(base64_url_nopad(&sig))
}

fn pem_to_der(pem: &str) -> anyhow::Result<Vec<u8>> {
    // Strip PEM headers and decode base64
    let mut s = pem.replace("\r", "");
    s = s.replace("-----BEGIN PRIVATE KEY-----", "");
    s = s.replace("-----END PRIVATE KEY-----", "");
    let s = s.replace('\n', "").trim().to_string();
    let der = B64.decode(s.as_bytes())?;
    Ok(der)
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

// ======== User OAuth helpers ========

#[derive(serde::Deserialize)]
struct ClaimsForEmail {
    email: Option<String>,
}

fn get_email_from_jwt_cookie(headers: &HeaderMap, secret: Option<&str>) -> Option<String> {
    let secret = secret?;
    let header_val = headers.get(axum::http::header::COOKIE)?;
    let cookie_str = header_val.to_str().ok()?;
    let jwt = cookie_str.split(';').filter_map(|p| {
        let t = p.trim();
        t.split_once('=').and_then(|(k,v)| if k=="jwt" { Some(v.to_string()) } else { None })
    }).next()?;
    let data = decode::<ClaimsForEmail>(&jwt, &DecodingKey::from_secret(secret.as_bytes()), &Validation::new(Algorithm::HS256)).ok()?;
    data.claims.email
}

async fn lookup_user_token(db_path: &str, email: &str) -> Option<String> {
    let db = Connection::open(db_path).ok()?;
    let mut stmt = db.prepare("SELECT access_token, expires_at FROM user_tokens WHERE email = ?1").ok()?;
    let mut rows = stmt.query(rusqlite::params![email]).ok()?;
    if let Some(row) = rows.next().ok().flatten() {
        let access_token: String = row.get(0).ok()?;
        let expires_at: i64 = row.get(1).ok()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs() as i64;
        if expires_at > now + 30 { // 30s leeway
            return Some(access_token);
        }
    }
    None
}

async fn sheets_api_read_with_token(client: &reqwest::Client, spreadsheet_id: &str, range: &str, access_token: &str) -> anyhow::Result<Vec<Vec<String>>> {
    let url = format!(
        "https://sheets.googleapis.com/v4/spreadsheets/{}/values/{}?majorDimension=ROWS",
        urlencoding::encode(spreadsheet_id),
        urlencoding::encode(range)
    );
    let resp = client.get(&url).bearer_auth(access_token).send().await?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        anyhow::bail!("Sheets API error {}: {}", status, body);
    }
    let v: Value = resp.json().await?;
    let values = v.get("values").and_then(|vv| vv.as_array()).cloned().unwrap_or_default();
    let out = values
        .into_iter()
        .map(|row| row
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .map(|cell| match cell {
                Value::String(s) => s,
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => if b { "true".to_string() } else { "false".to_string() },
                Value::Null => String::new(),
                other => other.to_string(),
            })
            .collect::<Vec<String>>()
        )
        .collect::<Vec<Vec<String>>>();
    Ok(out)
}
