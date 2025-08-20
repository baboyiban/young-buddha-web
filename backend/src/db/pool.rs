use rusqlite::{Connection, OpenFlags};
use std::path::Path;

/// Very small helper for opening a sqlite connection. For heavy workloads consider using r2d2 pool
pub fn open_sqlite_conn<P: AsRef<Path>>(path: P) -> rusqlite::Result<Connection> {
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
    Connection::open_with_flags(path, flags)
}

/// Get a database connection
pub fn get_connection(path: &str) -> rusqlite::Result<Connection> {
    open_sqlite_conn(path)
}

// Example helper that runs blocking DB work in tokio's blocking threadpool
#[allow(dead_code)]
pub async fn run_blocking<T, F: FnOnce(&Connection) -> T + Send + 'static>(path: &str, f: F) -> T
where
    T: Send + 'static,
{
    let path = path.to_string();
    tokio::task::spawn_blocking(move || {
        let conn = Connection::open(path).expect("open sqlite");
        f(&conn)
    })
    .await
    .expect("spawn join")
}

/// Initialize DB schema synchronously. Intended to be called at startup.
pub fn initialize_db_sync(path: &str) -> rusqlite::Result<()> {
    let conn = open_sqlite_conn(path)?;
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
    Ok(())
}

/// Async wrapper around `initialize_db_sync` using spawn_blocking.
pub async fn initialize_db(path: &str) -> rusqlite::Result<()> {
    let path = path.to_string();
    tokio::task::spawn_blocking(move || initialize_db_sync(&path))
        .await
        .expect("spawn join")
}
