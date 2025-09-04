use axum::{
    extract::{Query, State},
    http::HeaderMap,
    response::{IntoResponse, Redirect},
    routing::get,
    Json, Router,
};
use axum_extra::extract::cookie::{Cookie, CookieJar};
use serde_json::json;
use std::sync::Arc;

use crate::services::AppServices;
use crate::types::{AppError, CallbackQuery};

pub fn router() -> Router<Arc<AppServices>> {
    Router::new()
        .route("/google/login", get(google_login))
        .route("/google/callback", get(google_callback))
        .route("/logout", get(logout))
        .route("/me", get(get_current_user))
}

async fn google_login(
    State(services): State<Arc<AppServices>>,
    jar: CookieJar,
) -> Result<(CookieJar, Redirect), AppError> {
    let state_str = services.auth.oauth_service.generate_state();
    let cookie = services.auth.oauth_service.create_state_cookie(&state_str);
    let auth_url = services.auth.oauth_service.build_auth_url(&state_str);

    Ok((jar.add(cookie), Redirect::to(&auth_url)))
}

async fn google_callback(
    State(services): State<Arc<AppServices>>,
    Query(query): Query<CallbackQuery>,
    jar: CookieJar,
) -> (CookieJar, Redirect) {
    let state_from_cookie = jar.get("oauth_state").map(|c| c.value().to_string());
    let jar = jar.remove(Cookie::build("oauth_state").path("/"));

    match services.auth.handle_callback(query, state_from_cookie).await {
        Ok((auth_cookies, _user_data)) => {
            let mut new_jar = jar;
            for cookie_header in auth_cookies {
                if let Ok(cookie_str) = cookie_header.to_str() {
                    if let Ok(cookie) = Cookie::parse_encoded(cookie_str) {
                        new_jar = new_jar.add(cookie.into_owned());
                    }
                }
            }
            (new_jar, Redirect::to(&services.auth.config.server.frontend_url))
        }
        Err(e) => {
            tracing::error!("Login failed: {:?}", e);
            let error_string = e.to_string();
            let error_message = urlencoding::encode(&error_string);
            let redirect_url = format!("{}?login=error&message={}", &services.auth.config.server.frontend_url, error_message);
            (jar, Redirect::to(&redirect_url))
        }
    }
}

async fn logout(State(services): State<Arc<AppServices>>) -> impl IntoResponse {
    let cookie_headers = services.auth.oauth_service.create_logout_cookies();
    let mut headers = HeaderMap::new();
    for cookie in cookie_headers {
        headers.append(axum::http::header::SET_COOKIE, cookie);
    }
    (headers, axum::http::StatusCode::OK)
}

async fn get_current_user(
    State(services): State<Arc<AppServices>>,
    headers: HeaderMap,
) -> Result<Json<serde_json::Value>, AppError> {
    let email = services.auth.jwt_service.extract_email_from_headers(&headers)
        .ok_or_else(|| AppError::unauthorized("로그인이 필요합니다"))?;

    let user_profile = services.auth.get_user_profile(&email).await
        .ok_or_else(|| AppError::unauthorized("사용자 정보를 찾을 수 없습니다"))?;

    Ok(Json(json!({
        "authenticated": true,
        "email": user_profile.email,
        "name": user_profile.name,
        "role": user_profile.role
    })))
}
