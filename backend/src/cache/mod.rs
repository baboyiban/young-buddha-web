pub mod redis;

use async_trait::async_trait;
use std::any::Any;
pub use redis::RedisCache;

#[async_trait]
pub trait CacheProvider: Send + Sync {
    async fn get(&self, key: &str) -> Option<String>;
    async fn set(&self, key: &str, value: &str, ttl: i64) -> Result<(), crate::types::error::AppError>;
    async fn delete(&self, key: &str) -> Result<(), crate::types::error::AppError>;
    async fn get_hash(&self, key: &str, field: &str) -> Option<String>;
    async fn set_hash(&self, key: &str, field: &str, value: &str, ttl: i64) -> Result<(), crate::types::error::AppError>;

    // Any trait 지원을 위한 메소드
    fn as_any(&self) -> &dyn Any;
}
