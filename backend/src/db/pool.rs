use r2d2_sqlite::SqliteConnectionManager;
use std::path::Path;
use std::fs;
use crate::types::error::AppError;


pub type Pool = r2d2::Pool<SqliteConnectionManager>;
pub type Connection = r2d2::PooledConnection<SqliteConnectionManager>;

pub struct DatabasePool {
    pool: Pool,
}

impl DatabasePool {
    pub fn new(path: &str) -> Result<Self, AppError> {
        tracing::info!("Creating DatabasePool for path: {}", path);
        let db_path = Path::new(path);

        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                tracing::error!("Failed to create parent directory {:?}: {}", parent, e);
                AppError::Internal(format!("Failed to create db directory: {}", e))
            })?;
        }

        let manager = SqliteConnectionManager::file(db_path);
        let pool = r2d2::Pool::new(manager)
            .map_err(|e| AppError::Internal(format!("Failed to create db pool: {}", e)))?;

        // Initialize schema
        let conn = pool.get().map_err(|e| AppError::Internal(format!("Failed to get connection for schema init: {}", e)))?;
        Self::initialize(&conn)?;

        tracing::info!("DatabasePool initialized successfully");
        Ok(DatabasePool { pool })
    }

    pub fn get(&self) -> Result<Connection, AppError> {
        self.pool.get().map_err(|e| AppError::Internal(format!("Failed to get connection from pool: {}", e)))
    }

    pub async fn run_blocking<F, T>(&self, f: F) -> Result<T, AppError>
    where
        F: FnOnce(Connection) -> Result<T, AppError> + Send + 'static,
        T: Send + 'static,
    {
        let pool = self.pool.clone();
        tokio::task::spawn_blocking(move || {
            let conn = pool.get()?;
            f(conn)
        })
        .await
        .map_err(|e| AppError::Internal(format!("Database task join error: {}", e)))?
    }

    fn initialize(conn: &Connection) -> Result<(), AppError> {
        tracing::info!("Initializing database schema");
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS database_request (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                request_date TEXT NOT NULL,
                absent_date TEXT,
                partial_schedule TEXT,
                reason TEXT
            );

            CREATE TABLE IF NOT EXISTS user_tokens (
                email TEXT PRIMARY KEY,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                expires_at INTEGER NOT NULL
            );
            "#,
        )?;
        tracing::info!("Database schema ensured");
        Ok(())
    }
}