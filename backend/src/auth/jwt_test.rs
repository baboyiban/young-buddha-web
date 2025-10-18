#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderMap;

    #[test]
    fn test_jwt_encode_decode() {
        let jwt_service = JwtService::new("test_secret".to_string(), 3600);
        
        let token = jwt_service.encode("test_user", "test@example.com", "user");
        assert!(token.is_ok());

        let claims = jwt_service.decode(&token.unwrap());
        assert!(claims.is_ok());
        assert_eq!(claims.unwrap().email, "test@example.com");
    }

    #[test]
    fn test_extract_from_cookie() {
        let jwt_service = JwtService::new("test_secret".to_string(), 3600);
        
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "jwt=test_token_value; csrf_token=test_csrf".parse().unwrap());
        
        let token = jwt_service.extract_from_cookie(&headers);
        assert_eq!(token, Some("test_token_value".to_string()));
    }

    #[test]
    fn test_extract_from_cookie_no_jwt() {
        let jwt_service = JwtService::new("test_secret".to_string(), 3600);
        
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "csrf_token=test_csrf; session=abc123".parse().unwrap());
        
        let token = jwt_service.extract_from_cookie(&headers);
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_from_cookie_empty() {
        let jwt_service = JwtService::new("test_secret".to_string(), 3600);
        
        let headers = HeaderMap::new();
        
        let token = jwt_service.extract_from_cookie(&headers);
        assert_eq!(token, None);
    }
}