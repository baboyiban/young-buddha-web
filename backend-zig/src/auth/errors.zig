const std = @import("std");

/// Auth 모듈 전용 에러 타입들
pub const AuthError = error{
    // 환경 변수 관련
    MissingGoogleClientId,
    MissingGoogleClientSecret,
    MissingRedirectUri,

    // OAuth 관련
    InvalidUrl,
    HttpRequestFailed,
    HttpResponseFailed,
    OAuthTokenExchangeFailed,
    InvalidTokenResponse,

    // 세션/쿠키 관련
    MissingQuery,
    ParamNotFound,

    // JWT 관련
    TokenExpired,
    InvalidSignature,
    InvalidToken,

    // JSON 파싱 관련
    KeyNotFound,
    InvalidFormat,

    // 일반적인 에러
    OutOfMemory,
    Unexpected,
};

/// 에러 메시지 매핑
pub fn getErrorMessage(err: AuthError) []const u8 {
    return switch (err) {
        AuthError.MissingGoogleClientId => "Google Client ID is not configured",
        AuthError.MissingGoogleClientSecret => "Google Client Secret is not configured",
        AuthError.MissingRedirectUri => "Redirect URI is not configured",
        AuthError.InvalidUrl => "Invalid URL format",
        AuthError.HttpRequestFailed => "HTTP request failed",
        AuthError.HttpResponseFailed => "HTTP response failed",
        AuthError.OAuthTokenExchangeFailed => "OAuth token exchange failed",
        AuthError.InvalidTokenResponse => "Invalid token response format",
        AuthError.MissingQuery => "Missing query parameters",
        AuthError.ParamNotFound => "Required parameter not found",
        AuthError.TokenExpired => "Token has expired",
        AuthError.InvalidSignature => "Invalid token signature",
        AuthError.InvalidToken => "Invalid token format",
        AuthError.KeyNotFound => "JSON key not found",
        AuthError.InvalidFormat => "Invalid JSON format",
        AuthError.OutOfMemory => "Out of memory",
        AuthError.Unexpected => "Unexpected error occurred",
    };
}
