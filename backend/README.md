# young-buddha-backend (Rust)

Axum 기반의 Rust 백엔드. 기존 Zig 서버와 동일한 엔드포인트를 우선 501 Not Implemented로 매핑합니다.

## 개발

```sh
# 런타임 준비
cargo run -p young-buddha-backend
```

PORT 환경변수(기본 8080), STATIC_FILES_PATH(기본 ../frontend/dist)를 인식합니다.

## Google Sheets (비공개 스프레드시트 읽기)

이 서버는 다음 순서로 스프레드시트 읽기를 시도합니다.

1) 서비스 계정 + Google Sheets API v4 (비공개 시트 지원)
	- 환경변수 중 하나를 설정하세요:
	  - `GOOGLE_SERVICE_ACCOUNT_JSON` (인라인 JSON)
	  - 또는 `GOOGLE_SERVICE_ACCOUNT_JSON_PATH` (키 파일 경로)
	- 해당 스프레드시트를 서비스 계정 이메일에 "보기" 또는 "편집" 권한으로 공유해야 합니다.
	- 사용 스코프: `https://www.googleapis.com/auth/spreadsheets.readonly`

2) gviz 폴백 (공개 시트만)
	- 공개 또는 "웹에 게시"된 시트만 접근 가능합니다. 비공개면 401이 반환됩니다.

엔드포인트 예시:

```
GET /api/sheets/read?spreadsheet_id=...&range=시트명!A1:R1
```

.env 샘플은 `.env.example`를 참고하세요.
