use async_trait::async_trait;
use redis::{Commands, Client};
use sha2::{Digest, Sha256};
use std::any::Any;  // 이 import가 필요
use crate::cache::CacheProvider;
use crate::types::error::AppError;

pub struct RedisCache {
    client: Client,
    default_ttl: i64,
}

impl RedisCache {
    pub fn new(redis_url: String, default_ttl: i64) -> Result<Self, AppError> {
        let client = Client::open(redis_url)
            .map_err(|e| AppError::Cache(format!("Failed to create Redis client: {}", e)))?;

        Ok(Self { client, default_ttl })
    }

    pub fn build_sheets_key(&self, spreadsheet_id: &str, sheet_name: &str, query: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(spreadsheet_id.as_bytes());
        hasher.update(b"|");
        hasher.update(sheet_name.as_bytes());
        hasher.update(b"|");
        hasher.update(query.as_bytes());
        let hash = hex::encode(hasher.finalize());
        format!("sheets:query:{}", hash)
    }

    pub fn build_user_profile_key(&self, email: &str) -> String {
        format!("auth:user:{}", email)
    }

    pub fn build_jwt_key(&self, token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(token.as_bytes());
        let hash = hex::encode(hasher.finalize());
        format!("auth:jwt:{}", hash)
    }
}

#[async_trait]
impl CacheProvider for RedisCache {
    async fn get(&self, key: &str) -> Option<String> {
        let client = self.client.clone();
        let key = key.to_string();

        tokio::task::spawn_blocking(move || -> Option<String> {
            let mut conn = client.get_connection().ok()?;
            conn.get(key).ok()
        })
        .await
        .ok()
        .flatten()
    }

    async fn set(&self, key: &str, value: &str, ttl: i64) -> Result<(), AppError> {
        let client = self.client.clone();
        let key = key.to_string();
        let value = value.to_string();
        let ttl = if ttl > 0 { ttl } else { self.default_ttl };

        tokio::task::spawn_blocking(move || -> Result<(), redis::RedisError> {
            let mut conn = client.get_connection()?;
            let _: () = conn.set_ex(key, value, ttl as usize)?;
            Ok(())
        })
        .await
        .map_err(|e| AppError::Cache(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::Cache(format!("Redis error: {}", e)))?;

        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<(), AppError> {
        let client = self.client.clone();
        let key = key.to_string();

        tokio::task::spawn_blocking(move || -> Result<(), redis::RedisError> {
            let mut conn = client.get_connection()?;
            let _: () = conn.del(key)?;
            Ok(())
        })
        .await
        .map_err(|e| AppError::Cache(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::Cache(format!("Redis error: {}", e)))?;

        Ok(())
    }

    async fn get_hash(&self, key: &str, field: &str) -> Option<String> {
        let client = self.client.clone();
        let key = key.to_string();
        let field = field.to_string();

        tokio::task::spawn_blocking(move || -> Option<String> {
            let mut conn = client.get_connection().ok()?;
            conn.hget(key, field).ok()
        })
        .await
        .ok()
        .flatten()
    }

    async fn set_hash(&self, key: &str, field: &str, value: &str, ttl: i64) -> Result<(), AppError> {
        let client = self.client.clone();
        let key = key.to_string();
        let field = field.to_string();
        let value = value.to_string();
        let ttl = if ttl > 0 { ttl } else { self.default_ttl };

        tokio::task::spawn_blocking(move || -> Result<(), redis::RedisError> {
            let mut conn = client.get_connection()?;
            let _: () = redis::pipe()
                .hset(&key, field, value)
                .ignore()
                .expire(&key, ttl as usize)
                .query(&mut conn)?;
            Ok(())
        })
        .await
        .map_err(|e| AppError::Cache(format!("Task join error: {}", e)))?
        .map_err(|e| AppError::Cache(format!("Redis error: {}", e)))?;

        Ok(())
    }

    fn as_any(&self) -> &dyn Any {
        self
    }
}
