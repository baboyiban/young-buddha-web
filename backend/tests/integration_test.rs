use axum::{body::Body, http::{Request, StatusCode}};
use tower::ServiceExt;

use young_buddha_backend::config::{
    Config, ServerConfig, Environment, AuthConfig, CacheConfig, GoogleConfig, DatabaseConfig
};
use young_buddha_backend::{services::AppServices, routes::build_router};
use young_buddha_backend::auth::jwt::JwtService;
use axum::http::HeaderMap;

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

#[tokio::test]
async fn test_jwt_encode_decode() {
    let jwt_service = JwtService::new("test_secret".to_string(), 3600);
    
    let token = jwt_service.encode("test_user", "test@example.com", "user");
    assert!(token.is_ok());

    let claims = jwt_service.decode(&token.unwrap());
    assert!(claims.is_ok());
    assert_eq!(claims.unwrap().email, "test@example.com");
}

#[tokio::test]
async fn test_jwt_extract_from_cookie() {
    let jwt_service = JwtService::new("test_secret".to_string(), 3600);
    
    let mut headers = HeaderMap::new();
    headers.insert("cookie", "jwt=test_token_value; csrf_token=test_csrf".parse().unwrap());
    
    let token = jwt_service.extract_from_cookie(&headers);
    assert_eq!(token, Some("test_token_value".to_string()));
}

#[tokio::test]
async fn test_jwt_extract_from_cookie_no_jwt() {
    let jwt_service = JwtService::new("test_secret".to_string(), 3600);
    
    let mut headers = HeaderMap::new();
    headers.insert("cookie", "csrf_token=test_csrf; session=abc123".parse().unwrap());
    
    let token = jwt_service.extract_from_cookie(&headers);
    assert_eq!(token, None);
}

#[tokio::test]
async fn test_jwt_extract_from_cookie_empty() {
    let jwt_service = JwtService::new("test_secret".to_string(), 3600);
    
    let headers = HeaderMap::new();
    
    let token = jwt_service.extract_from_cookie(&headers);
    assert_eq!(token, None);
}
