use serde_json::Value;
use crate::types::ApiError;

// GViz(JSONP) 응답 텍스트에서 JSON 객체만 추출하여 파싱
pub fn parse_gviz_json(text: &str) -> Result<Value, ApiError> {
    println!("   🔧 [PARSER] action=start original_length={} bytes", text.len());
    
    let json_start = text.find('{')
        .ok_or_else(|| {
            println!("   ❌ [PARSER] error=json_start_not_found");
            ApiError::bad_gateway("PARSE_FAILED", "GViz 응답에서 JSON 시작 위치를 찾지 못했습니다.")
        })?;
    let json_end = text.rfind('}')
        .ok_or_else(|| {
            println!("   ❌ [PARSER] error=json_end_not_found");
            ApiError::bad_gateway("PARSE_FAILED", "GViz 응답에서 JSON 종료 위치를 찾지 못했습니다.")
        })?;
    
    if json_end < json_start {
        println!("   ❌ [PARSER] error=json_range_invalid start={} end={}", json_start, json_end);
        return Err(ApiError::bad_gateway("PARSE_FAILED", "GViz 응답의 JSON 범위가 올바르지 않습니다."));
    }
    
    let json_str = &text[json_start..=json_end];
    let preview = &json_str.chars().take(100).collect::<String>();
    println!("   📄 [PARSER] extracted_length={} bytes preview={}", json_str.len(), preview);
    
    let result = serde_json::from_str::<Value>(json_str)
        .map_err(|e| {
            println!("   ❌ [PARSER] error=json_parse_failed details={}", e);
            ApiError::bad_gateway("PARSE_FAILED", format!("JSON 파싱 실패: {}", e))
        })?;
    
    let row_count = if let Some(table) = result.get("table") {
        table.get("rows").and_then(|r| r.as_array()).map(|rows| rows.len()).unwrap_or(0)
    } else {
        0
    };
    println!("   ✅ [PARSER] success=true row_count={}", row_count);
    
    Ok(result)
}


#[cfg(test)]
mod tests {
    use super::parse_gviz_json;
    // serde_json::json not needed in these tests

    #[test]
    fn parses_plain_json() {
        let txt = r#"{"status":"ok","data":[1,2,3]}"#;
        let v = parse_gviz_json(txt).expect("should parse plain json");
        assert_eq!(v.get("status").and_then(|s| s.as_str()), Some("ok"));
        assert_eq!(v.get("data").and_then(|a| a.as_array()).unwrap().len(), 3);
    }

    #[test]
    fn parses_jsonp_wrapped() {
        let txt = "/*O_o*/\ngoogle.visualization.Query.setResponse({\n  \"status\": \"ok\",\n  \"rows\": []\n});";
        let v = parse_gviz_json(txt).expect("should parse jsonp gviz");
        assert_eq!(v.get("status").and_then(|s| s.as_str()), Some("ok"));
    }

    #[test]
    fn returns_err_on_invalid() {
        let txt = "no braces here";
        let r = parse_gviz_json(txt);
        assert!(r.is_err());
    }
}
