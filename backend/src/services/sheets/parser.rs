use serde_json::Value;
use crate::types::AppError;

pub fn parse_gviz_json(text: &str) -> Result<Value, AppError> {
    tracing::debug!("Parsing GViz response, length: {} bytes", text.len());

    let json_start = text.find('{')
        .ok_or_else(|| AppError::external_api("GViz 응답에서 JSON 시작 위치를 찾지 못했습니다"))?;

    let json_end = text.rfind('}')
        .ok_or_else(|| AppError::external_api("GViz 응답에서 JSON 종료 위치를 찾지 못했습니다"))?;

    if json_end < json_start {
        return Err(AppError::external_api("GViz 응답의 JSON 범위가 올바르지 않습니다"));
    }

    let json_str = &text[json_start..=json_end];
    let preview = &json_str.chars().take(100).collect::<String>();
    tracing::debug!("Extracted JSON preview: {}", preview);

    let result = serde_json::from_str::<Value>(json_str)
        .map_err(|e| AppError::external_api(format!("JSON 파싱 실패: {}", e)))?;

    let row_count = result.get("table")
        .and_then(|t| t.get("rows"))
        .and_then(|r| r.as_array())
        .map(|rows| rows.len())
        .unwrap_or(0);

    tracing::debug!("Successfully parsed GViz response with {} rows", row_count);

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_plain_json() {
        let txt = r#"{"status":"ok","data":[1,2,3]}"#;
        let v = parse_gviz_json(txt).expect("should parse plain json");
        assert_eq!(v.get("status").and_then(|s| s.as_str()), Some("ok"));
        assert_eq!(v.get("data").and_then(|a| a.as_array()).unwrap().len(), 3);
    }

    #[test]
    fn test_parse_jsonp_wrapped() {
        let txt = "/*O_o*/\ngoogle.visualization.Query.setResponse({\n  \"status\": \"ok\",\n  \"rows\": []\n});";
        let v = parse_gviz_json(txt).expect("should parse jsonp gviz");
        assert_eq!(v.get("status").and_then(|s| s.as_str()), Some("ok"));
    }

    #[test]
    fn test_invalid_json() {
        let txt = "no braces here";
        let r = parse_gviz_json(txt);
        assert!(r.is_err());
    }
}
