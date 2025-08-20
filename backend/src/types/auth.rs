#![allow(dead_code)]
use serde::Deserialize;

#[derive(Deserialize)]
pub struct CallbackQuery {
    pub code: Option<String>,
    pub state: Option<String>,
}

#[derive(Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: Option<String>,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
    #[allow(dead_code)]
    pub id_token: Option<String>,
}

#[derive(Deserialize)]
pub struct GoogleUserInfo {
    pub email: Option<String>,
    pub name: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct JwtClaims {
    pub name: String,
    pub email: String,
    pub role: String,
    pub exp: i64,
}

#[derive(Debug, Deserialize)]
pub struct AuthClaims {
    #[allow(dead_code)]
    pub sub: Option<String>,
    pub name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    #[allow(dead_code)]
    pub exp: Option<i64>,
    #[allow(dead_code)]
    pub access_token: Option<String>,
    #[allow(dead_code)]
    pub refresh_token: Option<String>,
}

#[derive(Deserialize)]
pub struct GoogleRefreshResponse {
    pub access_token: String,
    #[allow(dead_code)]
    pub token_type: Option<String>,
    pub expires_in: Option<i64>,
    pub refresh_token: Option<String>,
}
