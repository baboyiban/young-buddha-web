// 쿠키 관련 상수
pub const SESSION_COOKIE_NAME = "session";
pub const OAUTH_STATE_COOKIE_NAME = "oauth_state";
pub const JWT_COOKIE_NAME = "jwt";

// 환경 변수 키
pub const STATIC_FILES_PATH_KEY = "STATIC_FILES_PATH";

// Google OAuth2 관련 상수
pub const GOOGLE_SCOPE = "openid email profile https://www.googleapis.com/auth/spreadsheets";
pub const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
pub const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo";
pub const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// 토큰 만료 시간 (초)
pub const JWT_EXPIRY_SECONDS = 60 * 60 * 24; // 24시간
pub const OAUTH_STATE_EXPIRY_SECONDS = 300; // 5분
pub const SESSION_COOKIE_EXPIRY_SECONDS = 60 * 60 * 24; // 24시간

// HTTP 관련 상수
pub const DEFAULT_PORT = 8080;
pub const MAX_REQUEST_BODY_SIZE = 10 * 1024; // 10KB
pub const MAX_RESPONSE_BUFFER_SIZE = 16 * 1024; // 16KB

// 데이터베이스 관련 상수
pub const DEFAULT_DB_PATH = "app.db";
