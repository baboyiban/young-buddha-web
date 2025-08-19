use axum::body::Body;
use axum::http::Request;
use axum::response::Response;
use tower::util::ServiceExt; // for oneshot

use young_buddha_backend::routes;
use young_buddha_backend::AppState;

#[tokio::test]
async fn health_ok() {
    // AppState::from_env already returns Arc<AppState>
    let state = AppState::from_env();
    let app = routes::build_router(state.clone()).with_state(state.clone());

    let req = Request::builder()
        .uri("/api/health")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let resp: Response = app.oneshot(req).await.unwrap();
    assert_eq!(resp.status().as_u16(), 200);
}
