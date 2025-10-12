use rusqlite::{Connection, OpenFlags};
use std::path::Path;
use std::fs;
use std::sync::{Arc, Mutex};
use crate::types::error::AppError;

pub struct DatabasePool {
    pub path: String,
    connection: Arc<Mutex<Option<Connection>>>,
}

impl DatabasePool {
    pub fn new(path: String) -> Result<Self, AppError> {
        tracing::info!("Creating DatabasePool for path: {}", path);
        let connection = Arc::new(Mutex::new(None));
        let db = Self { path, connection };

        // Initialize with a connection
        db.create_connection()?;
        tracing::info!("DatabasePool initialized successfully");
        Ok(db)
    }

    fn create_connection(&self) -> Result<(), AppError> {
        let mut conn_guard = self.connection.lock().map_err(|e| {
            AppError::Internal(format!("Failed to acquire connection lock: {}", e))
        })?;

        if conn_guard.is_none() {
            let conn = self.get_connection()?;
            *conn_guard = Some(conn);
        }
        Ok(())
    }

    pub fn get_connection(&self) -> Result<Connection, AppError> {
        let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
        let db_path = Path::new(&self.path);

        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| {
                    tracing::error!("Failed to create parent directory {:?}: {}", parent, e);
                    AppError::Database(rusqlite::Error::FromSqlConversionFailure(
                        0, rusqlite::types::Type::Text, Box::new(e)
                    ))
                })?;
        }

        if !db_path.exists() {
            fs::File::create(&db_path)
                .map_err(|e| {
                    tracing::error!("Failed to create DB file {:?}: {}", db_path, e);
                    AppError::Database(rusqlite::Error::FromSqlConversionFailure(
                        0, rusqlite::types::Type::Text, Box::new(e)
                    ))
                })?;
        }

        Ok(Connection::open_with_flags(db_path, flags)?)
    }

    pub fn get_pooled_connection(&self) -> Result<Connection, AppError> {
        // Try to get existing connection from pool
        if let Ok(mut conn_guard) = self.connection.lock() {
            if let Some(conn) = conn_guard.take() {
                return Ok(conn);
            }
        }

        // Fallback to creating new connection
        self.get_connection()
    }

    pub fn return_connection(&self, conn: Connection) -> Result<(), AppError> {
        if let Ok(mut conn_guard) = self.connection.lock() {
            *conn_guard = Some(conn);
        }
        Ok(())
    }

    pub async fn run_blocking<T, F>(&self, f: F) -> Result<T, AppError>
    where
        T: Send + 'static,
        F: FnOnce(&Connection) -> Result<T, AppError> + Send + 'static,
    {
        let path = self.path.clone();
        tokio::task::spawn_blocking(move || {
            let pool = DatabasePool::new(path)?;
            let conn = pool.get_pooled_connection()?;
            let result = f(&conn)?;
            // Return connection to pool after use
            pool.return_connection(conn).ok();
            Ok(result) as Result<T, AppError>
        })
        .await
        .map_err(|e| AppError::Internal(format!("Task join error: {}", e)))?
    }

    fn initialize(&self) -> Result<(), AppError> {
        tracing::info!("Initializing database schema at: {}", self.path);
        let conn = self.get_connection()?;
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
