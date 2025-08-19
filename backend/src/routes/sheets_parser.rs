use serde_json::Value;
use crate::types::ApiError;

// GViz(JSONP) 응답 텍스트에서 JSON 객체만 추출하여 파싱
pub fn parse_gviz_json(text: &str) -> Result<Value, ApiError> {
    let json_start = text.find('{')
        .ok_or_else(|| ApiError::bad_gateway("PARSE_FAILED", "GViz 응답에서 JSON 시작 위치를 찾지 못했습니다."))?;
    let json_end = text.rfind('}')
        .ok_or_else(|| ApiError::bad_gateway("PARSE_FAILED", "GViz 응답에서 JSON 종료 위치를 찾지 못했습니다."))?;
    if json_end < json_start {
        return Err(ApiError::bad_gateway("PARSE_FAILED", "GViz 응답의 JSON 범위가 올바르지 않습니다."));
    }
    let json_str = &text[json_start..=json_end];
    serde_json::from_str::<Value>(json_str)
        .map_err(|e| ApiError::bad_gateway("PARSE_FAILED", format!("JSON 파싱 실패: {}", e)))
}
