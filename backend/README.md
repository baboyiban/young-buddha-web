# young-buddha-backend — 구조 가이드

이 문서는 현재 백엔드( Rust + axum )의 권장 파일/모듈 구조와 각 모듈의 책임, 서버 시작 순서, 개발 규칙과 우선 적용할 리팩토링 항목을 한눈에 보기 쉽게 정리합니다.

## 한눈에 보는 파일 트리

```
backend/
	Cargo.toml
	README.md              # 이 문서
	src/
		main.rs              # 서버 시작점 (bin)
		lib.rs               # 라이브러리 진입점(모듈 재수출)
		config.rs            # AppConfig (env 파싱·검증)
		types.rs             # 도메인 타입, AppState (경량)
		state.rs             # AppState re-export
		routes/              # HTTP 라우트 모듈(버전/기능별)
			mod.rs             # routes::build_router
			health.rs          # /api/health 핸들러
			auth.rs
			sheets.rs
			database.rs
			...
		auth/                # 인증 관련 유틸 (jwt, redis cache)
			mod.rs
			redis_cache.rs
		db/                  # DB 관련 (pool, init, helpers)
			mod.rs
			pool.rs             # sqlite open, initialize_db
		services/            # 비즈니스 로직(핸들러에서 호출)
			mod.rs
		api/                 # (선택) API 버전별 라우터 스캐폴드
		util/                # 공통 유틸
		tests/               # integration tests
```

## 모듈별 책임(간단)
- `main.rs`: 트래픽을 받기 전 앱 초기화 책임(로깅, dotenv, config load, async DB init, Redis init, 라우터 바인딩). 가능한 비동기 초기화는 `main`에서 수행.
- `config.rs`: 모든 환경변수 파싱과 검증을 담당. production에서 필요한 시크릿 검증은 여기서 수행.
- `types.rs` / `state.rs`: 런타임에서 공유되는 `AppState` 구조(HTTP client, DB path, redis client, jwt secret 등)를 보관하지만 초기화(특히 블로킹 작업)은 `db::pool` 같은 모듈로 위임.
- `db/pool.rs`: DB 연결과 스키마 초기화 책임. 블로킹 작업은 `spawn_blocking` 또는 비동기 래퍼로 실행.
- `routes/*`: HTTP layer — 핸들러는 요청 검증 후 `services` 계층을 호출하고, 결과를 `IntoResponse`로 반환.
- `services/*`: 도메인 로직(데이터 처리, 외부 API 호출, 트랜잭션 관리) — 테스트 가능한 작은 함수로 구성.
- `auth/*`: JWT 생성·검증, Redis 기반 세션 캐시 책임.

## 서버 시작 순서(권장)
1. dotenv 로드
2. tracing/로깅 초기화
3. `AppConfig::from_env()`로 설정 파싱·검증
4. `AppState::from_env()`로 기본 상태 객체 생성(비동기 스텝은 생성 후 `main`에서 실행)
5. `db::initialize_db(&app_state.db_path).await` — 스키마, 마이그레이션 적용
6. Redis/외부 클라이언트 초기화(필요시 재시도/backoff)
7. 라우터 빌드 및 바인딩

## 코딩 규칙(권장)
- DB: rusqlite 사용 시 블로킹 쿼리는 `tokio::task::spawn_blocking`으로 감싼다. 장기적으로 `sqlx`로 마이그레이션 권장.
- 에러: 공통 에러 타입(한 파일)에 모아 `IntoResponse` 구현으로 HTTP 변환 일원화.
- 라우트: 핸들러는 얇게 유지(요청 validate -> service 호출 -> map to response).
- 테스트: DB 종속 테스트는 인메모리 sqlite 또는 테스트 전용 DB 파일을 사용.

## 우선 적용할 리팩토링(단계별)
1. (완료) env parsing 통합: `config.rs` 생성 및 `AppState`에서 재사용.
2. (완료) DB init 분리: `db/pool.rs::initialize_db_sync` 추가 및 `AppState::from_env()`에서 위임.
3. (권장) 비동기 초기화: `main.rs`에서 `db::initialize_db(&app_state.db_path).await`로 변경 — 서버 시작 시 블로킹 제거.
4. (권장) 헬스체크 강화: DB ping, Redis ping 포함.
5. (중간) 에러 타입 통합: `types::ApiError` 또는 `errors.rs` 중 하나로 통일.
6. (장기) DB 드라이버 전환: `sqlx` 또는 Postgres로 이전 고려.

## 체크리스트(빠르게 둘러보기)
- [ ] `config.rs`에 모든 env 키 문서화
- [ ] `db/pool.rs`에 migration hook 추가(refinery/sqlx-migrate)
- [ ] `/api/health`에 DB/Redis 체크 도입
- [ ] CI(Actions)로 `cargo fmt`, `cargo clippy`, `cargo test` 자동화

## 다음 단계 제안 (제가 바로 할 수 있는 것)
- A: `main.rs`에서 동기 DB init 제거하고 `db::initialize_db(...).await` 호출로 비동기 초기화 적용 (권장)
- B: `/api/health`에 DB/Redis 체크 추가

원하시면 A와 B를 바로 적용하고 빌드/테스트를 검증하겠습니다.
