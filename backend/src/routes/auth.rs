use crate::services::auth::AuthService;
use crate::types::{ApiError, AppState, CallbackQuery};
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Redirect},
    routing::get,
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar, SameSite};
use serde_json::Value;
use std::sync::Arc;
use time;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/google/login", get(google_login))
        .route("/google/callback", get(google_callback))
        .route("/logout", get(logout))
        .route("/me", get(get_current_user))
}

#[axum::debug_handler]
async fn google_login(
    State(state): State<Arc<AppState>>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), ApiError> {
    let state_str = AuthService::generate_oauth_state();

    // State를 암호화된 쿠키에 저장합니다.
    let is_prod = !state.frontend_url.contains("localhost");
    let cookie = Cookie::build(("oauth_state", state_str.clone()))
        .path("/")
        .http_only(true)
        .same_site(if is_prod { SameSite::None } else { SameSite::Lax })
        .secure(is_prod)
        .max_age(time::Duration::minutes(10)) // 10분 유효시간
        .build();

    let client_id = state
        .config
        .get_google_client_id()
        .map_err(|e| ApiError::internal_error(e.to_string()))?;
    let redirect_uri = state
        .config
        .get_google_redirect_uri()
        .map_err(|e| ApiError::internal_error(e.to_string()))?;
    let scope = "openid email";

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?{}",
        serde_urlencoded::to_string([
            ("client_id", client_id.as_str()),
            ("redirect_uri", redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", scope),
            ("state", &state_str),
            ("access_type", "offline"),
            ("prompt", "consent"),
        ])
        .unwrap()
    );

    Ok((jar.add(cookie), Redirect::to(&auth_url)))
}

#[axum::debug_handler]
async fn google_callback(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CallbackQuery>,
    jar: CookieJar,
) -> (CookieJar, Redirect) {
    // 쿠키에서 state 값 가져오기
    let state_from_cookie = jar.get("oauth_state").map(|c| c.value().to_string());

    // oauth_state 쿠키는 이제 필요 없으므로 미리 제거합니다.
    let jar = jar.remove(Cookie::build("oauth_state").path("/"));

    // 콜백 받은 state와 쿠키의 state를 서비스로 넘겨 검증
    match AuthService::handle_google_callback(state.clone(), query, state_from_cookie).await {
        Ok((auth_cookies, _user_data)) => {
            let mut new_jar = jar;
            // AuthService에서 생성한 인증 관련 쿠키들을 jar에 추가
            for cookie_header in auth_cookies {
                if let Ok(cookie_str) = cookie_header.to_str() {
                    if let Ok(cookie) = Cookie::parse_encoded(cookie_str) {
                        new_jar = new_jar.add(cookie.into_owned());
                    }
                }
            }
            (new_jar, Redirect::to(&state.frontend_url))
        }
        Err(e) => {
            tracing::error!("Login failed: {:?}", e);
            // 에러 메시지를 URL-safe하게 인코딩하여 전달
            let error_message = urlencoding::encode(&e.message);
            let redirect_url = format!("{}/login?login=error&message={}", &state.frontend_url, error_message);
            (jar, Redirect::to(&redirect_url))
        }
    }
}

#[axum::debug_handler]
async fn logout(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let cookie_headers = AuthService::logout(&state.frontend_url);
    let mut headers = HeaderMap::new();
    for cookie in cookie_headers {
        headers.append(header::SET_COOKIE, cookie);
    }
    (headers, StatusCode::OK)
}

#[axum::debug_handler]
async fn get_current_user(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<Value>, ApiError> {
    let user_data = AuthService::get_current_user(state, headers).await?;
    Ok(Json(user_data))
}
