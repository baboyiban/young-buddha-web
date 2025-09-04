use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;

use young_buddha_backend::config::{
    Config, ServerConfig, Environment, AuthConfig, CacheConfig, GoogleConfig, DatabaseConfig
};
use young_buddha_backend::{services::AppServices, routes::build_router};

#[tokio::test]
async fn test_health_endpoint() {
    let config = Config {
        server: ServerConfig {
            port: 8080,
            environment: Environment::Development,
            frontend_url: "http://localhost:3000".to_string(),
        },
        auth: AuthConfig {
            jwt_secret: "testsecret".to_string(),
            jwt_expiry_seconds: 3600,
            cookie_domain: None,
        },
        cache: CacheConfig {
            redis_url: None,
            default_ttl: 3600,
            sheets_cache_ttl: 30,
            user_profile_ttl: 1800,
        },
        google: GoogleConfig {
            client_id: "test".to_string(),
            client_secret: "test".to_string(),
            redirect_uri: "http://localhost:3000".to_string(),
            service_account_key_path: None,
            user_sheet_spreadsheet_id: None,
            user_sheet_name: None,
        },
        database: DatabaseConfig {
            path: "./test.db".to_string(),
        },
    };

    let services = AppServices::new(config).await.unwrap();
    let app = build_router(services);

    let response = app
        .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
}
