use sha2::{Digest, Sha256};
use redis::Commands;
use once_cell::sync::OnceCell;

// Global reusable Redis client to avoid opening a client every request
static GLOBAL_REDIS: OnceCell<redis::Client> = OnceCell::new();

/// Initialize global redis client. Safe to call multiple times (first wins).
pub fn init_global_redis(client: redis::Client) {
    let _ = GLOBAL_REDIS.set(client);
}

#[allow(dead_code)]
fn get_client_from_env_or_global() -> Option<redis::Client> {
    if let Some(c) = GLOBAL_REDIS.get() {
        return Some(c.clone());
    }
    // fallback to env var for backward compatibility
    std::env::var("REDIS_URL").ok().and_then(|u| redis::Client::open(u).ok())
}

// Small helpers for Redis-backed JWT cache. These use blocking redis APIs
// and run inside tokio::task::spawn_blocking from the caller.

#[allow(dead_code)]
pub async fn get_cached_jwt(token: &str) -> Option<serde_json::Value> {
    if let Some(client) = get_client_from_env_or_global() {
        let token_clone = token.to_string();
        let client_move = client.clone();
        if let Ok(Ok(Some(cached))) = tokio::task::spawn_blocking(move || -> Result<Option<String>, redis::RedisError> {
            let mut conn = client_move.get_connection()?;
            let mut hasher = Sha256::new();
            hasher.update(token_clone.as_bytes());
            let key = format!("auth:jwt:{}", hex::encode(hasher.finalize()));
            let val: Option<String> = conn.get(key)?;
            Ok(val)
        }).await
        {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&cached) {
                return Some(v);
            }
        }
    }
    None
}

#[allow(dead_code)]
pub async fn store_valid_jwt(token: &str, cached_obj: serde_json::Value) -> Result<(), ()> {
    if let Some(client) = get_client_from_env_or_global() {
        let token_clone = token.to_string();
        let client_move = client.clone();
        let cached = cached_obj.to_string();
        let _ = tokio::task::spawn_blocking(move || -> Result<(), redis::RedisError> {
            let mut conn = client_move.get_connection()?;
            let mut hasher = Sha256::new();
            hasher.update(token_clone.as_bytes());
            let key = format!("auth:jwt:{}", hex::encode(hasher.finalize()));
            let _: () = conn.set_ex(key, cached, 1800)?;
            Ok(())
        }).await;
    }
    Ok(())
}

// ============ User profile cache (email -> {name, role}) ============

#[allow(dead_code)]
pub async fn get_cached_user_profile(email: &str) -> Option<(String, String)> {
    if let Some(client) = get_client_from_env_or_global() {
        let email_clone = email.to_string();
        let client_move = client.clone();
        if let Ok(Ok(Some(cached))) = tokio::task::spawn_blocking(move || -> Result<Option<(String, String)>, redis::RedisError> {
            let mut conn = client_move.get_connection()?;
            let key = format!("auth:user:{}", email_clone);
            let name: Option<String> = conn.hget(&key, "name").ok();
            let role: Option<String> = conn.hget(&key, "role").ok();
            Ok(match (name, role) {
                (Some(n), Some(r)) => Some((n, r)),
                _ => None,
            })
        }).await {
            return cached;
        }
    }
    None
}

#[allow(dead_code)]
pub async fn store_user_profile(email: &str, name: &str, role: &str, ttl_seconds: usize) -> Result<(), ()> {
    if let Some(client) = get_client_from_env_or_global() {
        let email_clone = email.to_string();
        let name_clone = name.to_string();
        let role_clone = role.to_string();
        let client_move = client.clone();
        let _ = tokio::task::spawn_blocking(move || -> Result<(), redis::RedisError> {
            let mut conn = client_move.get_connection()?;
            let key = format!("auth:user:{}", email_clone);
            let _: () = redis::pipe()
                .hset(&key, "name", name_clone)
                .ignore()
                .hset(&key, "role", role_clone)
                .ignore()
                .expire(&key, ttl_seconds)
                .query(&mut conn)?;
            Ok(())
        }).await;
    }
    Ok(())
}
