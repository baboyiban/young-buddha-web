# syntax=docker/dockerfile:1.7

# 빌드 스테이지
FROM --platform=linux/amd64 rust:1.89-alpine AS builder

# 빌드에 필요한 패키지 설치
RUN apk add --no-cache \
    musl-dev \
    openssl-dev \
    openssl-libs-static \
    pkgconfig \
    ca-certificates

# 작업 디렉터리 설정
WORKDIR /app

# Cargo.lock과 Cargo.toml을 먼저 복사하여 의존성 캐시 활용
COPY Cargo.toml Cargo.lock ./

# 더미 main.rs와 lib.rs 생성 (의존성 빌드를 위해 필요)
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    echo "" > src/lib.rs

# 의존성 먼저 빌드 (캐시 활용)
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    rm -rf src

# 소스 코드 복사
COPY src ./src

# 애플리케이션 빌드
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    mv target/release/young-buddha-backend /app/young-buddha-backend

# 런타임 스테이지
FROM --platform=linux/amd64 alpine:3.19 AS runtime

# 런타임에 필요한 패키지 설치
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    wget && \
    update-ca-certificates

# 애플리케이션 사용자 생성
RUN addgroup -g 1001 -S appuser && \
    adduser -S appuser -u 1001

# 작업 디렉터리 설정
WORKDIR /app

# 빌드된 바이너리 복사
COPY --from=builder --chown=appuser:appuser /app/young-buddha-backend /app/young-buddha-backend

# 데이터 디렉터리 생성 및 권한 설정
RUN mkdir -p /app/data && chmod -R 775 /app/data && chown -R appuser:appuser /app/data

# 애플리케이션 실행
USER appuser
ENTRYPOINT ["/app/young-buddha-backend"]