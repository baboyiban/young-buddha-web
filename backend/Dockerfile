# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM rust:1.89-bullseye AS builder
WORKDIR /app

# Install SQLCipher/SQLite dependencies for rusqlite bundled feature if needed
RUN apt-get update && apt-get install -y --no-install-recommends pkg-config libssl-dev ca-certificates && rm -rf /var/lib/apt/lists/*

# Cache dependencies
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release && \
    mv target/release/young-buddha-backend /app/young-buddha-backend

# --- Runtime stage ---
FROM debian:bullseye-slim AS runtime
WORKDIR /app

# Minimal runtime deps
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -m -u 10001 appuser

# App files
COPY --from=builder /app/young-buddha-backend /app/young-buddha-backend

# Data directory for SQLite
RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

ENV PORT=8080 \
    DB_PATH=/app/data/data.db \
    RUST_LOG=info

EXPOSE 8080

CMD ["/app/young-buddha-backend"]
