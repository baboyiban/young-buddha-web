use axum::http::HeaderMap;
use cookie::Cookie;

pub struct CookieUtils;

impl CookieUtils {
    pub fn extract_token_from_cookie(headers: &HeaderMap, token_name: &str) -> Option<String> {
        let cookie_header = headers.get("cookie")?;
        let cookie_str = cookie_header.to_str().ok()?;

        cookie_str
            .split(';')
            .filter_map(|part| Cookie::parse(part.trim().to_string()).ok())
            .find(|cookie| cookie.name() == token_name)
            .map(|cookie| cookie.value().to_string())
    }

    pub fn extract_simple_cookie(headers: &HeaderMap, cookie_name: &str) -> Option<String> {
        let cookie_header = headers.get("cookie")?;
        let cookie_str = cookie_header.to_str().ok()?;

        cookie_str.split(';').find_map(|part| {
            let trimmed = part.trim();
            if let Some((key, value)) = trimmed.split_once('=') {
                if key == cookie_name {
                    Some(value.to_string())
                } else {
                    None
                }
            } else {
                None
            }
        })
    }
}

#[cfg(test)]
mod tests {
    use super::CookieUtils;
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