use std::sync::Arc;
use reqwest::Client;
use rusqlite::OptionalExtension;
use serde_json::json;
use time::OffsetDateTime;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::config::Config;
use crate::db::DatabasePool;
use crate::cache::CacheProvider;
use crate::auth::{JwtService, OAuthService};
use crate::types::{AppError, CallbackQuery, GoogleRefreshResponse, UserProfile, TokenResponse};

pub struct AuthService {
    pub jwt_service: JwtService,
    pub oauth_service: OAuthService,
    pub config: Arc<Config>,
    http_client: Client,
    db_pool: Arc<DatabasePool>,
    pub cache: Option<Arc<dyn CacheProvider>>,
}

impl AuthService {
    pub fn new(
        config: Arc<Config>,
        http_client: Client,
        db_pool: Arc<DatabasePool>,
        cache: Option<Arc<dyn CacheProvider>>,
    ) -> Self {
        let jwt_service = JwtService::new(
            config.auth.jwt_secret.clone(),
            config.auth.jwt_expiry_seconds,
        );

        let oauth_service = OAuthService::new(config.clone(), http_client.clone());

        Self {
            jwt_service,
            oauth_service,
            config,
            http_client,
            db_pool,
            cache,
        }
    }

    pub async fn handle_callback(
        &self,
        query: CallbackQuery,
        state_from_cookie: Option<String>,
    ) -> Result<(Vec<axum::http::HeaderValue>, serde_json::Value), AppError> {
        // State 검증
        self.oauth_service.validate_state(query.state.clone(), state_from_cookie)?;

        // 토큰 교환 및 사용자 정보 가져오기
        let (token_data, user_info) = self.oauth_service.exchange_code(query).await?;

        let email = user_info.email.unwrap_or_else(|| "unknown@example.com".to_string());
        let mut name = user_info.name.unwrap_or_else(|| "Unknown User".to_string());

        // Google 토큰 저장
        self.store_user_tokens(&email, &token_data).await?;

        // 사용자 프로필 해결 (스프레드시트에서)
        let (resolved_name, resolved_role) = self.resolve_user_profile(&email).await;

        // 스프레드시트에 등록되지 않은 사용자 거부
        if resolved_name.is_none() && resolved_role.is_none() {
            tracing::error!("User not found in spreadsheet: {}", email);
            return Err(AppError::unauthorized("스프레드시트에 등록되지 않은 사용자입니다"));
        }

        if let Some(n) = resolved_name {
            name = n;
        }
        let role = resolved_role.unwrap_or_else(|| "USER".to_string());

        // JWT 토큰 생성
        let jwt_token = self.jwt_service.encode(&name, &email, &role)?;

        // 쿠키 생성
        let cookies = self.oauth_service.create_auth_cookies(&jwt_token);

        let response_data = json!({
            "success": true,
            "user": {
                "name": name,
                "email": email,
                "role": role
            }
        });

        Ok((cookies, response_data))
    }

    pub async fn get_user_profile(&self, email: &str) -> Option<UserProfile> {
        // 캐시에서 먼저 확인
        if let Some(cache) = &self.cache {
            if let Some(cached_name) = cache.get_hash(&format!("auth:user:{}", email), "name").await {
                if let Some(cached_role) = cache.get_hash(&format!("auth:user:{}", email), "role").await {
                    return Some(UserProfile {
                        email: email.to_string(),
                        name: cached_name,
                        role: cached_role,
                    });
                }
            }
        }

        // 스프레드시트에서 조회
        let (name_opt, role_opt) = self.resolve_user_profile(email).await;

        if let (Some(name), Some(role)) = (name_opt, role_opt) {
            let profile = UserProfile {
                email: email.to_string(),
                name: name.clone(),
                role: role.clone(),
            };

            // 캐시에 저장
            if let Some(cache) = &self.cache {
                let key = format!("auth:user:{}", email);
                let _ = cache.set_hash(&key, "name", &name, self.config.cache.user_profile_ttl).await;
                let _ = cache.set_hash(&key, "role", &role, self.config.cache.user_profile_ttl).await;
            }

            return Some(profile);
        }

        None
    }

    pub async fn get_valid_user_token(&self, email: &str) -> Option<String> {
        // DB에서 토큰 조회
        let row: Option<(String, i64)> = self.db_pool.run_blocking({
            let email = email.to_string();
            move |conn| -> Result<Option<(String, i64)>, AppError> {
                let mut stmt = conn.prepare("SELECT access_token, expires_at FROM user_tokens WHERE email = ?1")?;
                let result = stmt.query_row(rusqlite::params![email], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))
                }).optional()?;
                Ok(result)
            }
        }).await.ok().flatten();

        if let Some((access_token, expires_at)) = row {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .ok()?
                .as_secs() as i64;

            if expires_at > now + 30 {
                return Some(access_token);
            }
        }

        // 토큰이 만료되었으면 refresh
        self.refresh_user_token(email).await
    }

    async fn refresh_user_token(&self, email: &str) -> Option<String> {
        // Refresh 토큰 조회
        let refresh_token: Option<String> = self.db_pool.run_blocking({
            let email = email.to_string();
            move |conn| -> Result<Option<String>, AppError> {
                let mut stmt = conn.prepare("SELECT refresh_token FROM user_tokens WHERE email = ?1")?;
                let result = stmt.query_row(rusqlite::params![email], |row| {
                    row.get::<_, Option<String>>(0)
                }).optional()?;
                Ok(result.flatten())
            }
        }).await.ok().flatten();

        let refresh_token = refresh_token?;

        // Google API로 refresh
        let form = [
            ("grant_type", "refresh_token"),
            ("client_id", self.config.google.client_id.as_str()),
            ("client_secret", self.config.google.client_secret.as_str()),
            ("refresh_token", refresh_token.as_str()),
        ];

        let resp = self.http_client
            .post("https://oauth2.googleapis.com/token")
            .form(&form)
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() {
            tracing::warn!("Google refresh token request failed for user: {}", email);
            return None;
        }

        let gr: GoogleRefreshResponse = resp.json().await.ok()?;
        let new_access = gr.access_token.clone();
        let expires_in = gr.expires_in.unwrap_or(3600);
        let new_expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;

        // DB 업데이트
        let _ = self.db_pool.run_blocking({
            let email = email.to_string();
            let new_access = new_access.clone();
            let new_rt = gr.refresh_token.clone();
            move |conn| -> Result<(), AppError> {
                conn.execute(
                    "UPDATE user_tokens
                     SET access_token = ?1,
                         expires_at = ?2,
                         refresh_token = COALESCE(?3, refresh_token)
                     WHERE email = ?4",
                    rusqlite::params![new_access, new_expires_at, new_rt, email],
                )?;
                Ok(())
            }
        }).await;

        Some(new_access)
    }

    async fn store_user_tokens(&self, email: &str, token_data: &TokenResponse) -> Result<(), AppError> {
        let expires_in = token_data.expires_in.unwrap_or(3600);
        let expires_at = OffsetDateTime::now_utc().unix_timestamp() + expires_in;

        self.db_pool.run_blocking({
            let email = email.to_string();
            let access_token = token_data.access_token.clone();
            let refresh_token = token_data.refresh_token.clone();
            move |conn| -> Result<(), AppError> {
                conn.execute(
                    "INSERT INTO user_tokens (email, access_token, refresh_token, expires_at)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT(email) DO UPDATE SET
                        access_token = excluded.access_token,
                        refresh_token = COALESCE(excluded.refresh_token, user_tokens.refresh_token),
                        expires_at = excluded.expires_at",
                    rusqlite::params![email, access_token, refresh_token, expires_at],
                )?;
                Ok(())
            }
        }).await?;

        Ok(())
    }

    async fn resolve_user_profile(&self, email: &str) -> (Option<String>, Option<String>) {
        let spreadsheet_id = match &self.config.google.user_sheet_spreadsheet_id {
            Some(id) => id,
            None => return (None, None),
        };

        let sheet_name = match &self.config.google.user_sheet_name {
            Some(name) => name,
            None => return (None, None),
        };

        let query = format!("SELECT B,C WHERE A = '{}'", email.replace("'", "''"));
        let url = format!(
            "https://docs.google.com/spreadsheets/d/{}/gviz/tq?tqx=out:json&tq={}&sheet={}",
            spreadsheet_id,
            urlencoding::encode(&query),
            urlencoding::encode(sheet_name)
        );

        // Use service account token for server-side sheet access
        let key_path = match &self.config.google.service_account_key_path {
            Some(p) if !p.is_empty() => p.clone(),
            _ => {
                tracing::error!("Service account key path not configured; cannot query spreadsheet");
                return (None, None);
            }
        };

        let mut sa_auth = crate::services::google_service_account::GoogleServiceAccountAuth::new(key_path);
        let token = match sa_auth.get_access_token().await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Failed to obtain service account token: {:?}", e);
                return (None, None);
            }
        };

        let resp = match self.http_client.get(&url).bearer_auth(token).send().await {
            Ok(r) => r,
            Err(_) => return (None, None),
        };

        if !resp.status().is_success() {
            return (None, None);
        }

        let text = match resp.text().await {
            Ok(t) => t,
            Err(_) => return (None, None),
        };

        let parsed: serde_json::Value = match crate::services::sheets::parser::parse_gviz_json(&text) {
            Ok(v) => v,
            Err(_) => return (None, None),
        };

        let rows = parsed.get("table")
            .and_then(|t| t.get("rows"))
            .and_then(|r| r.as_array());

        if let Some(rows) = rows {
            if let Some(row0) = rows.get(0) {
                let cells = row0.get("c").and_then(|c| c.as_array());
                if let Some(cells) = cells {
                    let name = cells.get(0)
                        .and_then(|c| c.get("v"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let role = cells.get(1)
                        .and_then(|c| c.get("v"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    return (name, role);
                }
            }
        }

        (None, None)
    }
}
