use sha2::{Digest, Sha256};
use redis::Commands;

// Small helpers for Redis-backed JWT cache. These use blocking redis APIs
// and run inside tokio::task::spawn_blocking from the caller.

pub async fn get_cached_jwt(token: &str) -> Option<serde_json::Value> {
    if let Ok(redis_url) = std::env::var("REDIS_URL") {
        if let Ok(client) = redis::Client::open(redis_url) {
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
    }
    None
}

pub async fn store_valid_jwt(token: &str, cached_obj: serde_json::Value) -> Result<(), ()> {
    if let Ok(redis_url) = std::env::var("REDIS_URL") {
        if let Ok(client) = redis::Client::open(redis_url) {
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
    }
    Ok(())
}
