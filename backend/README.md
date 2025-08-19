# Backend 구조 및 개발 가이드

이 문서는 현재 백엔드( Rust / axum )의 권장 모듈 구조, 책임 분리, 개발 체크리스트, 운영/테스트 권장 사항을 정리합니다.

## 목표
- 모듈 경계(라우트 / 서비스 / 저장소 / 모델 / auth / middleware) 명확화
- 에러/응답 포맷 통일
- DB 연결 풀과 블로킹 작업 취급(현재 rusqlite 사용 고려)
- 인증 책임 분리(JWT, redis)
- 테스트·CI 규칙 정의

## 권장 디렉터리 구조

```
backend/src/
	main.rs
	config.rs          # 환경변수 파싱 및 검증
	state.rs           # AppState: DB 연결, redis client, config
	errors.rs          # 공통 에러 타입 및 IntoResponse 구현
	models/            # 데이터 모델
	db/                # 저장소 레이어 (repo)
		pool.rs          # DB pool 생성 및 helper
	services/          # 비즈니스 로직
	api/               # HTTP 핸들러 (버전별)
	auth/              # JWT, redis cache 등 인증 관련
	middleware/        # 공통 미들웨어
	util/              # 유틸리티 함수
	tests/             # integration tests
```

## 체크리스트

- [ ] `config.rs`로 env 파싱(프로덕션 필수값 검사 포함)
- [ ] `errors.rs`로 에러/응답 통일
- [ ] DB pool을 `db/pool.rs`로 분리. rusqlite 사용 시 `spawn_blocking` 또는 r2d2사용
- [ ] auth 모듈 분리: `auth/jwt.rs`, `auth/redis_cache.rs`
- [ ] 서비스 레이어 추가: 핸들러는 서비스 호출만 하도록
- [ ] 헬스체크 `/health` 엔드포인트 추가
- [ ] `tracing` 기반 로깅 레벨/포맷 설정
- [ ] CI: fmt, clippy, test

## 개발/실행 가이드 (간단)

- 로컬: 환경변수 `.env` 설정 후

```
cargo build
cargo run --bin young-buddha-backend
```

- 테스트

```
cargo test
```

## 다음 단계
이 README를 기준으로 작은 리팩토링(구성 파일 추가, 에러 타입 추가, DB pool 스캐폴드)을 적용했습니다. 남은 작업: 서비스/리포지토리 구체 구현, 인증 리팩토링, 마이그레이션 도구 도입 등.

자세한 변경 사항과 실행 방법은 아래 파일들을 참고하세요.
