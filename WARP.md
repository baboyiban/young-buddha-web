# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Frontend (Next.js)

```bash
# Install dependencies
cd frontend && bun install

# Development
cd frontend && bun dev

# Type checking
cd frontend && bun type-check

# Linting
cd frontend && bun lint

# Production build
cd frontend && bun build
```

### Backend (Rust)

```bash
# Build
cd backend && cargo build

# Run development server
cd backend && cargo run

# Run tests
cd backend && cargo test

# Lint
cd backend && cargo clippy

# Format code
cd backend && cargo fmt
```

### Full Stack Development

```bash
# Run both frontend and backend concurrently
cd frontend && bun dev:with-backend
```

## Architecture Overview

This is a full-stack web application with a Next.js frontend and a Rust backend.

### Backend Architecture

The backend follows a layered architecture:

- HTTP Layer (`routes/*`) - Request handling and response formatting
- Services Layer (`services/*`) - Business logic implementation
- Data Layer (`db/*`) - Database operations
- Authentication (`auth/*`) - JWT and Redis session management

Key components:
- `axum` for HTTP routing and middleware
- SQLite for database (with future plans to migrate to SQLx/Postgres)
- Redis for session caching
- JWT for authentication

Server initialization flow:
1. Environment configuration loading
2. Logging setup
3. Database initialization
4. Redis client setup
5. Router binding

### Frontend Architecture

Next.js application with:
- TypeScript for type safety
- Tailwind CSS for styling
- Built-in ESLint configuration
- Concurrent development setup with backend

## Environment Setup

Backend requires:
- `.env` file (copy from `.env.example`)
- Redis server running
- SQLite (bundled with `rusqlite`)

Frontend requires:
- `.env.local` file (copy from `.env.local.example`)
- Bun package manager

## Special Considerations

- Backend DB operations should be wrapped in `tokio::task::spawn_blocking` when using `rusqlite`
- Health checks should include both DB and Redis connectivity
- Error handling is centralized in the backend
- Frontend-backend communication assumes `/api` prefix for backend routes
