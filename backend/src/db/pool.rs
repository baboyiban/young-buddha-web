use rusqlite::{Connection, OpenFlags};
use std::path::Path;

/// Very small helper for opening a sqlite connection. For heavy workloads consider using r2d2 pool
pub fn open_sqlite_conn<P: AsRef<Path>>(path: P) -> rusqlite::Result<Connection> {
    let flags = OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE;
    Connection::open_with_flags(path, flags)
}

// Example helper that runs blocking DB work in tokio's blocking threadpool
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
