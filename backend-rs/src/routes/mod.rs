pub mod auth;
pub mod sheets;
pub mod database;
pub mod payment;

use axum::Router;
use crate::state::AppState;
use std::sync::Arc;

pub fn build_router(state: Arc<AppState>) -> Router<Arc<AppState>> {
    // Build API router with the same state type
    let api: Router<Arc<AppState>> = Router::new()
        .merge(auth::router::<Arc<AppState>>())
        .merge(sheets::router::<Arc<AppState>>())
        .merge(database::router::<Arc<AppState>>())
        .merge(payment::router::<Arc<AppState>>());

    Router::new()
        .nest("/api", api)
        .merge(crate::web::static_router(state))
}
