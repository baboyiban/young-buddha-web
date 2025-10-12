use std::fs;
use std::path::Path;
use young_buddha_backend::db::pool::DatabasePool;

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> String {
        let test_path = "/tmp/test_young_buddha.db";
        if Path::new(test_path).exists() {
            fs::remove_file(test_path).ok();
        }
        test_path.to_string()
    }

    #[tokio::test]
    async fn test_database_pool_creation() {
        let db_path = setup_test_db();
        let pool_result = DatabasePool::new(db_path.clone());

        assert!(pool_result.is_ok());
        let pool = pool_result.unwrap();
        assert_eq!(pool.path, db_path);
    }

    #[tokio::test]
    async fn test_database_connection() {
        let db_path = setup_test_db();
        let pool = DatabasePool::new(db_path.clone()).unwrap();

        let conn_result = pool.get_connection();
        assert!(conn_result.is_ok());

        let conn = conn_result.unwrap();
        let result = conn.execute(
            "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
            []
        );
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_database_operations() {
        let db_path = setup_test_db();
        let pool = DatabasePool::new(db_path.clone()).unwrap();

        let result = pool.run_blocking(|conn| {
            conn.execute(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT UNIQUE)",
                []
            )?;

            conn.execute(
                "INSERT INTO users (email) VALUES (?1)",
                ["test@example.com"]
            )?;

            let mut stmt = conn.prepare("SELECT COUNT(*) FROM users")?;
            let count: i64 = stmt.query_row([], |row| row.get(0))?;

            assert_eq!(count, 1);
            Ok(())
        }).await;

        assert!(result.is_ok());
    }
}