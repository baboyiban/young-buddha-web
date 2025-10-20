use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::engine::Engine as _;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use time::OffsetDateTime;
use crate::types::AppError;
use tokio::sync::RwLock;
use std::sync::Arc;
use openssl::rsa::Rsa;
use openssl::pkey::PKey;
use openssl::sign::Signer;
use openssl::hash::MessageDigest;

#[derive(Debug, Serialize, Deserialize)]
struct ServiceAccountKey {
    #[serde(rename = "type")]
    key_type: String,
    project_id: String,
    private_key_id: String,
    private_key: String,
    client_email: String,
    client_id: String,
    auth_uri: String,
    token_uri: String,
    auth_provider_x509_cert_url: String,
    client_x509_cert_url: String,
}

#[derive(Debug, Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: i64,
    #[allow(dead_code)]
    token_type: String,
}

#[derive(Clone)]
struct SaAuthState {
    cached_token: Option<String>,
    expires_at: i64,
}

#[derive(Clone)]
pub struct GoogleServiceAccountAuth {
    key_path: String,
    state: Arc<RwLock<SaAuthState>>,
}

impl GoogleServiceAccountAuth {
    pub fn new(key_path: String) -> Self {
        Self {
            key_path,
            state: Arc::new(RwLock::new(SaAuthState { cached_token: None, expires_at: 0 })),
        }
    }

    /// 안전한 동시성 캐시 접근: fast-read (read lock) -> double-checked write lock
    pub async fn get_access_token(&self) -> Result<String, AppError> {
        if self.key_path.is_empty() {
            tracing::error!("Service account key path not configured");
            return Err(AppError::Config("Service account key path not configured".to_string()));
        }

        let now = SystemTime::now().duration_since(UNIX_EPOCH)
            .map_err(|e| AppError::internal(format!("Failed to get current time: {}", e)))?
            .as_secs() as i64;

        // Fast path: read lock
        {
            let read = self.state.read().await;
            if let Some(token) = &read.cached_token {
                if read.expires_at > now + 60 {
                    return Ok(token.clone());
                }
            }
        }

        // Acquire write lock and double-check to avoid stampede
        let mut write = self.state.write().await;
        if let Some(token) = &write.cached_token {
            if write.expires_at > now + 60 {
                return Ok(token.clone());
            }
        }

        // Read and parse key file (do NOT log key contents)
        let key_content = tokio::fs::read_to_string(&self.key_path).await
            .map_err(|e| {
                tracing::error!("Failed to read service account key file '{}': {}", self.key_path, e);
                AppError::internal(format!("Failed to read service account key file"))
            })?;

        let sa_key: ServiceAccountKey = serde_json::from_str(&key_content)
            .map_err(|e| {
                tracing::error!("Failed to parse service account key file: {}", e);
                AppError::internal("Failed to parse service account key".to_string())
            })?;

        let jwt = build_and_sign_jwt(&sa_key, "https://www.googleapis.com/auth/spreadsheets")?;

        // Exchange JWT for access token
        let client = reqwest::Client::new();
        let form = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ];

        let resp = client.post(&sa_key.token_uri).form(&form).send().await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            tracing::error!("Service account token request failed: status={}, body={}", status, body);
            return Err(AppError::external_api(format!("Failed to get service account access token: status={}", status)));
        }

        let token_response: TokenResponse = resp.json().await?;

        // Cache the token safely
        write.cached_token = Some(token_response.access_token.clone());
        write.expires_at = now + token_response.expires_in;

        Ok(token_response.access_token)
    }
}

/// JWT 생성·서명 유틸 (모듈화)
fn build_and_sign_jwt(sa_key: &ServiceAccountKey, scope: &str) -> Result<String, AppError> {
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let expiry = now + 3600;

    let claim = serde_json::json!({
        "iss": sa_key.client_email,
        "scope": scope,
        "aud": sa_key.token_uri,
        "exp": expiry,
        "iat": now
    });

    let header = serde_json::json!({
        "alg": "RS256",
        "typ": "JWT",
        "kid": sa_key.private_key_id
    });

    let header_b64 = URL_SAFE_NO_PAD.encode(serde_json::to_string(&header).map_err(|e| AppError::internal(format!("Failed to serialize JWT header: {}", e)))?);
    let claim_b64 = URL_SAFE_NO_PAD.encode(serde_json::to_string(&claim).map_err(|e| AppError::internal(format!("Failed to serialize JWT claim: {}", e)))?);
    let signing_input = format!("{}.{}", header_b64, claim_b64);

    // Sign with openssl (errors mapped to generic internal errors to avoid leaking secrets)
    let private_key = Rsa::private_key_from_pem(sa_key.private_key.as_bytes())
        .map_err(|_e| AppError::internal("Failed to parse private key".to_string()))?;
    let pkey = PKey::from_rsa(private_key).map_err(|_e| AppError::internal("Failed to create PKey".to_string()))?;
    let mut signer = Signer::new(MessageDigest::sha256(), &pkey).map_err(|_e| AppError::internal("Failed to create signer".to_string()))?;
    signer.update(signing_input.as_bytes()).map_err(|_e| AppError::internal("Failed to update signer".to_string()))?;
    let signature = signer.sign_to_vec().map_err(|_e| AppError::internal("Failed to sign JWT".to_string()))?;
    let signature_b64 = URL_SAFE_NO_PAD.encode(signature);
    Ok(format!("{}.{}", signing_input, signature_b64))
}