use axum::{Router, response::Json, http::StatusCode};
use serde_json::{json, Value};

pub fn router<S: Clone + Send + Sync + 'static>() -> Router<S> {
    Router::new()
        .route("/mission", axum::routing::get(get_mission_data))
}

async fn get_mission_data() -> Result<Json<Value>, StatusCode> {
    // 임시 목업 데이터 - 실제로는 Google Sheets API나 데이터베이스에서 가져와야 함
    let mission_data = vec![
        "2025-01-15", // date
        "수",         // dayOfWeek
        "김철수",     // morningMeal[0]
        "이영희",     // morningMeal[1]
        "박민수",     // morningHelper[0]
        "정수진",     // morningHelper[1]
        "최영수",     // morningDishes[0]
        "한지민",     // morningDishes[1]
        "송민호",     // morningDishes[2]
        "김영진",     // laundry.wash
        "이수정",     // laundry.hang
        "박준호",     // laundry.fold
        "정민아",     // afternoonCushion[0]
        "최수빈",     // afternoonCushion[1]
        "한민수",     // eveningMeal[0]
        "송지은",     // eveningMeal[1]
        "김태현",     // eveningMeal[2]
        "이현주",     // eveningCushion
    ];

    Ok(Json(json!(mission_data)))
}