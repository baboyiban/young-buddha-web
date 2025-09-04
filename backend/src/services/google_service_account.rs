use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::engine::Engine as _;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use time::OffsetDateTime;
use crate::types::AppError;

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
    token_type: String,
}

#[derive(Clone)]
pub struct GoogleServiceAccountAuth {
    key_path: String,
    cached_token: Option<String>,
    token_expires_at: Option<i64>,
}

impl GoogleServiceAccountAuth {
    pub fn new(key_path: String) -> Self {
        Self {
            key_path,
            cached_token: None,
            token_expires_at: None,
        }
    }

    pub async fn get_access_token(&mut self) -> Result<String, AppError> {
        if self.key_path.is_empty() {
            return Err(AppError::Config("Service account key path not configured".to_string()));
        }

        // Check if token is still valid (with 1 minute buffer)
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| AppError::internal(format!("Failed to get current time: {}", e)))?
            .as_secs() as i64;

        if let (Some(token), Some(expires_at)) = (&self.cached_token, self.token_expires_at) {
            if expires_at > now + 60 {
                return Ok(token.clone());
            }
        }

        // Read service account key file
        let key_content = tokio::fs::read_to_string(&self.key_path)
            .await
            .map_err(|e| AppError::internal(format!("Failed to read service account key file: {}", e)))?;

        // Parse service account key
        let sa_key: ServiceAccountKey = serde_json::from_str(&key_content)
            .map_err(|e| AppError::internal(format!("Failed to parse service account key: {}", e)))?;

        // Create JWT claim
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let expiry = now + 3600; // 1 hour

        let claim = serde_json::json!({
            "iss": sa_key.client_email,
            "scope": "https://www.googleapis.com/auth/spreadsheets",
            "aud": sa_key.token_uri,
            "exp": expiry,
            "iat": now
        });

        // Create JWT header
        let header = serde_json::json!({
            "alg": "RS256",
            "typ": "JWT",
            "kid": sa_key.private_key_id
        });

        // Encode JWT
        let header_b64 = URL_SAFE_NO_PAD.encode(serde_json::to_string(&header).unwrap());
        let claim_b64 = URL_SAFE_NO_PAD.encode(serde_json::to_string(&claim).unwrap());
        let signing_input = format!("{}.{}", header_b64, claim_b64);

        // Sign JWT with RSA private key
        let private_key = openssl::rsa::Rsa::private_key_from_pem(sa_key.private_key.as_bytes())
            .map_err(|e| AppError::internal(format!("Failed to parse private key: {}", e)))?;

        let pkey = openssl::pkey::PKey::from_rsa(private_key)
            .map_err(|e| AppError::internal(format!("Failed to create PKey: {}", e)))?;

        let mut signer = openssl::sign::Signer::new(
            openssl::hash::MessageDigest::sha256(),
            &pkey,
        ).map_err(|e| AppError::internal(format!("Failed to create signer: {}", e)))?;

        signer.update(signing_input.as_bytes())
            .map_err(|e| AppError::internal(format!("Failed to update signer: {}", e)))?;

        let signature = signer.sign_to_vec()
            .map_err(|e| AppError::internal(format!("Failed to sign JWT: {}", e)))?;

        let signature_b64 = URL_SAFE_NO_PAD.encode(signature);
        let jwt = format!("{}.{}", signing_input, signature_b64);

        // Exchange JWT for access token
        let client = reqwest::Client::new();
        let form = [
            ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
            ("assertion", &jwt),
        ];

        let resp = client
            .post(&sa_key.token_uri)
            .form(&form)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::external_api(format!(
                "Failed to get service account access token: status={}, body={}",
                status, body
            )));
        }

        let token_response: TokenResponse = resp.json().await?;

        // Cache the token
        self.cached_token = Some(token_response.access_token.clone());
        self.token_expires_at = Some(now + token_response.expires_in);

        Ok(token_response.access_token)
    }
}
