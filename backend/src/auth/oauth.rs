use axum::http::HeaderValue;
use axum_extra::extract::cookie::{Cookie, SameSite};
use rand::{distributions::Alphanumeric, Rng};
use reqwest::Client;

use std::sync::Arc;
use time::Duration;
use crate::config::{Config, Environment};
use crate::types::{AppError, CallbackQuery, GoogleUserInfo, TokenResponse};

pub struct OAuthService {
    config: Arc<Config>,
    http_client: Client,
}

impl OAuthService {
    pub fn new(config: Arc<Config>, http_client: Client) -> Self {
        Self { config, http_client }
    }

    pub fn generate_state(&self) -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(32)
            .map(char::from)
            .collect()
    }

    pub fn create_state_cookie(&self, state: &str) -> Cookie<'static> {
        let is_prod = self.config.server.environment == Environment::Production;

        Cookie::build(("oauth_state", state.to_string()))
            .path("/")
            .http_only(true)
            .same_site(if is_prod { SameSite::None } else { SameSite::Lax })
            .secure(is_prod)
            .max_age(Duration::minutes(10))
            .build()
    }

    pub fn create_auth_cookies(&self, jwt_token: &str) -> Vec<HeaderValue> {
        let mut cookies = Vec::new();
        let is_prod = self.config.server.environment == Environment::Production;
        let domain_opt = &self.config.auth.cookie_domain;
        let same_site = if is_prod { "None" } else { "Lax" };
        let secure = if is_prod { "; Secure" } else { "" };
        let max_age = self.config.auth.jwt_expiry_seconds;

        // JWT 토큰 쿠키
        let jwt_cookie = if let Some(domain) = domain_opt {
            format!(
                "jwt={}; HttpOnly{}; SameSite={}; Path=/; Domain={}; Max-Age={}",
                jwt_token, secure, same_site, domain, max_age
            )
        } else {
            format!(
                "jwt={}; HttpOnly{}; SameSite={}; Path=/; Max-Age={}",
                jwt_token, secure, same_site, max_age
            )
        };
        cookies.push(HeaderValue::from_str(&jwt_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // 인증 상태 쿠키
        let auth_cookie = if let Some(domain) = domain_opt {
            format!(
                "is_authenticated=true; SameSite={}; Path=/; Domain={}; Max-Age={}{}",
                same_site, domain, max_age, secure
            )
        } else {
            format!(
                "is_authenticated=true; SameSite={}; Path=/; Max-Age={}{}",
                same_site, max_age, secure
            )
        };
        cookies.push(HeaderValue::from_str(&auth_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        // CSRF 토큰 쿠키
        let csrf_token: String = rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(48)
            .map(char::from)
            .collect();

        let csrf_cookie = if let Some(domain) = domain_opt {
            format!(
                "csrf_token={}; SameSite={}; Path=/; Domain={}; Max-Age={}{}",
                csrf_token, same_site, domain, max_age, secure
            )
        } else {
            format!(
                "csrf_token={}; SameSite={}; Path=/; Max-Age={}{}",
                csrf_token, same_site, max_age, secure
            )
        };
        cookies.push(HeaderValue::from_str(&csrf_cookie).unwrap_or_else(|_| HeaderValue::from_static("")));

        cookies
    }

    pub fn create_logout_cookies(&self) -> Vec<HeaderValue> {
        let mut cookies = Vec::new();
        let is_prod = self.config.server.environment == Environment::Production;
        let domain_opt = &self.config.auth.cookie_domain;
        let same_site = if is_prod { "None" } else { "Lax" };
        let secure = if is_prod { "; Secure" } else { "" };

        let cookie_names = ["jwt", "is_authenticated", "csrf_token"];

        for name in &cookie_names {
            let cookie = if let Some(domain) = domain_opt {
                format!(
                    "{}=; HttpOnly{}; SameSite={}; Path=/; Domain={}; Max-Age=0",
                    name, secure, same_site, domain
                )
            } else {
                format!(
                    "{}=; HttpOnly{}; SameSite={}; Path=/; Max-Age=0",
                    name, secure, same_site
                )
            };
            cookies.push(HeaderValue::from_str(&cookie).unwrap_or_else(|_| HeaderValue::from_static("")));
        }

        cookies
    }

    pub fn build_auth_url(&self, state: &str) -> String {
        let params = [
            ("client_id", self.config.google.client_id.as_str()),
            ("redirect_uri", self.config.google.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", "openid email profile"),
            ("state", state),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ];

        format!(
            "https://accounts.google.com/o/oauth2/v2/auth?{}",
            serde_urlencoded::to_string(params).unwrap()
        )
    }

    pub async fn exchange_code(&self, query: CallbackQuery) -> Result<(TokenResponse, GoogleUserInfo), AppError> {
        let code = query.code.ok_or_else(|| AppError::validation("Missing authorization code"))?;

        let form = [
            ("code", code.as_str()),
            ("client_id", self.config.google.client_id.as_str()),
            ("client_secret", self.config.google.client_secret.as_str()),
            ("redirect_uri", self.config.google.redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
        ];

        let token_resp = self.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&form)
            .send()
            .await?;

        if !token_resp.status().is_success() {
            let error_text = token_resp.text().await.unwrap_or_default();
            tracing::error!("OAuth token exchange failed: {}", error_text);
            return Err(AppError::external_api("OAuth token exchange failed"));
        }

        let token_data: TokenResponse = token_resp.json().await?;

        let user_resp = self.http_client
            .get("https://www.googleapis.com/oauth2/v2/userinfo")
            .bearer_auth(&token_data.access_token)
            .send()
            .await?;

        if !user_resp.status().is_success() {
            let error_text = user_resp.text().await.unwrap_or_default();
            tracing::error!("User info fetch failed: {}", error_text);
            return Err(AppError::external_api("User info fetch failed"));
        }

        let user_info: GoogleUserInfo = user_resp.json().await?;

        Ok((token_data, user_info))
    }

    pub fn validate_state(&self, query_state: Option<String>, cookie_state: Option<String>) -> Result<(), AppError> {
        let query_state = query_state.ok_or_else(|| AppError::validation("Missing state parameter"))?;
        let cookie_state = cookie_state.ok_or_else(|| AppError::validation("Missing state cookie"))?;

        if query_state != cookie_state {
            tracing::error!("OAuth state mismatch: query={}, cookie={}", query_state, cookie_state);
            return Err(AppError::validation("OAuth state mismatch"));
        }

        Ok(())
    }
}
