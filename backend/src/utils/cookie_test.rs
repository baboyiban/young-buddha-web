
#[cfg(test)]
mod tests {
    use super::super::cookie::CookieUtils;
    use axum::http::HeaderMap;

    #[test]
    fn test_extract_token_from_cookie_valid() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "other=value; my_token=token123; another=value".parse().unwrap());
        let token = CookieUtils::extract_token_from_cookie(&headers, "my_token");
        assert_eq!(token, Some("token123".to_string()));
    }

    #[test]
    fn test_extract_token_from_cookie_not_found() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "other=value; another=value".parse().unwrap());
        let token = CookieUtils::extract_token_from_cookie(&headers, "my_token");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_token_from_cookie_empty_headers() {
        let headers = HeaderMap::new();
        let token = CookieUtils::extract_token_from_cookie(&headers, "my_token");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_simple_cookie_valid() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "other=value; my_cookie=cookie123; another=value".parse().unwrap());
        let cookie = CookieUtils::extract_simple_cookie(&headers, "my_cookie");
        assert_eq!(cookie, Some("cookie123".to_string()));
    }

    #[test]
    fn test_extract_simple_cookie_not_found() {
        let mut headers = HeaderMap::new();
        headers.insert("cookie", "other=value; another=value".parse().unwrap());
        let cookie = CookieUtils::extract_simple_cookie(&headers, "my_cookie");
        assert_eq!(cookie, None);
    }

    #[test]
    fn test_extract_simple_cookie_empty_headers() {
        let headers = HeaderMap::new();
        let cookie = CookieUtils::extract_simple_cookie(&headers, "my_cookie");
        assert_eq!(cookie, None);
    }
}
