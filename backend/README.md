# young-buddha-backend (Rust)

Axum 기반의 Rust 백엔드. 기존 Zig 서버와 동일한 엔드포인트를 우선 501 Not Implemented로 매핑합니다.

## 개발

```sh
# 런타임 준비
cargo run -p young-buddha-backend
```

PORT 환경변수(기본 8080), STATIC_FILES_PATH(기본 ../frontend/dist)를 인식합니다.
