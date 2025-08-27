# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM rust:1.89-alpine AS builder
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
  musl-dev \
  openssl-dev \
  pkgconfig \
  ca-certificates

# Create dummy source to cache dependencies
COPY Cargo.toml Cargo.lock ./
RUN mkdir -p src && \
  echo "fn main() {}" > src/main.rs && \
  echo "" > src/lib.rs

# Cache dependencies
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/app/target \
  cargo build --release && \
  rm -rf src

# Copy actual source code
COPY src ./src

# Build the application
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/app/target \
  cargo build --release && \
  mv target/release/young-buddha-backend /app/young-buddha-backend

# --- Runtime stage ---
FROM alpine:3.19 AS runtime
WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
  ca-certificates \
  tzdata \
  wget \
  && update-ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S appuser && \
  adduser -S appuser -u 1001

# Copy built binary
COPY --from=builder --chown=appuser:appuser /app/young-buddha-backend /app/young-buddha-backend

# Create data directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

# Switch to non-root user
USER appuser

# Environment variables
ENV PORT=8080 \
  DB_PATH=/app/data/data.db \
  RUST_LOG=info \
  TZ=Asia/Seoul

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the application
CMD ["/app/young-buddha-backend"]
