use axum::{Router, routing::{get, post, delete}, response::{IntoResponse, Response}, Json, extract::State};
use serde_json::json;
use crate::types::AppState;
use crate::types::{CallbackQuery};
use crate::services::AuthService;
use std::sync::Arc;
use axum::http::{HeaderMap, header::SET_COOKIE};
use axum::extract::Query;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/google", post(google_auth))
        .route("/google", get(google_auth_get))
        .route("/google/callback", get(google_callback))
        .route("/me", get(me))
        .route("/logout", delete(logout))
}

async fn google_auth(State(state): State<Arc<AppState>>) -> Response {
    let oauth_state = AuthService::generate_oauth_state();
    AuthService::store_oauth_state(&oauth_state);

    let client_id = match state.config.get_google_client_id() {
        Ok(v) => v,
        Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"Missing GOOGLE_CLIENT_ID"}))).into_response()
    };
    let redirect_uri = match state.config.get_google_redirect_uri() {
        Ok(v) => v,
        Err(_) => return (axum::http::StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error":true,"message":"Missing GOOGLE_REDIRECT_URI"}))).into_response()
    };

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope=openid%20email%20profile&state={}",
        client_id,
        urlencoding::encode(&redirect_uri),
        oauth_state
    );

    (axum::http::StatusCode::OK, Json(json!({"auth_url": auth_url}))).into_response()
}

async fn google_auth_get(State(state): State<Arc<AppState>>) -> Response {
    google_auth(State(state)).await
}

async fn google_callback(
    State(state): State<Arc<AppState>>,
    Query(q): Query<CallbackQuery>,
    headers: HeaderMap
) -> Response {
    match AuthService::handle_google_callback(state.clone(), q, headers).await {
        Ok((cookies, _response_data)) => {
            // 로그인 성공 시 프론트엔드 홈페이지로 리다이렉트
            let redirect_url = format!("{}/?login=success", state.frontend_url);
            let mut response = axum::response::Redirect::to(&redirect_url).into_response();
            let response_headers = response.headers_mut();

            // 쿠키 설정
            for cookie in cookies {
                response_headers.append(SET_COOKIE, cookie);
            }

            response
        }
        Err(_err) => {
            // 로그인 실패 시 로그인 페이지로 리다이렉트
            let redirect_url = format!("{}/login?login=error", state.frontend_url);
            axum::response::Redirect::to(&redirect_url).into_response()
        }
    }
}

async fn me(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    match AuthService::get_current_user(state, headers).await {
        Ok(response_data) => (axum::http::StatusCode::OK, Json(response_data)).into_response(),
        Err(err) => err.into_response(),
    }
}

async fn logout(State(state): State<Arc<AppState>>) -> Response {
    let cookies = AuthService::logout(&state.frontend_url);
    let mut response = (axum::http::StatusCode::OK, Json(json!({"success": true, "message": "로그아웃되었습니다"}))).into_response();
    let response_headers = response.headers_mut();

    for cookie in cookies {
        response_headers.append(SET_COOKIE, cookie);
    }

    response
}
