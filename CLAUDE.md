# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Young Buddha Web is a full-stack web application with a Rust backend (Axum) and Next.js frontend. The project uses Docker for containerized development and production deployments.

### Architecture

- **Backend**: Rust + Axum web framework with SQLite database
- **Frontend**: Next.js 14 with TypeScript and Tailwind CSS 4
- **Authentication**: JWT + Google OAuth with CSRF protection
- **Database**: SQLite with Redis for optional caching

## Development Commands

### Using Makefile (Recommended)

The project includes a comprehensive Makefile with common development tasks:

```bash
# Development environment
make dev                    # Start development environment
make backend               # Start only backend service
make frontend              # Start only frontend service

# Production environment
make prod                   # Start production environment (detached)
make prod-up               # Start production stack
make prod-down             # Stop production stack

# Testing
make test-backend          # Run backend tests
make test-frontend         # Run frontend tests

# Utility commands
make stop                  # Stop all containers
make clean                 # Clean containers and volumes
make logs                  # View logs from all services
make status                # Check container status
make restart               # Restart all services

# Environment setup
make setup-dev             # Create development environment files
make setup-prod            # Create production environment files
```

### Direct Docker Commands

```bash
# Development
cd /Users/choidaruhan/git/young-buddha-web
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Frontend Development

```bash
cd frontend
bun dev                    # Start Next.js development server
bun build                  # Build for production
bun start                  # Start production server
bun lint                   # Run ESLint
bun type-check             # Run TypeScript type checking
```

### Frontend Testing

⚠️ **Important**: When using Bun, always use `bun run test` instead of `bun test` to ensure Vitest is used correctly.

```bash
cd frontend
bun run test               # Run tests with Vitest
bun run test:watch         # Run tests in watch mode
bun run test:run           # Run tests once (CI mode)
bun run test:coverage      # Run tests with coverage
bun run test:ci            # CI-specific test command
```

### Backend Development

```bash
cd backend
cargo run                  # Start Rust backend
cargo test                 # Run backend tests
cargo build --release      # Build for production
```

## Project Structure

```
young-buddha-web/
├── backend/               # Rust backend
│   ├── src/
│   │   ├── auth/         # Authentication (JWT, Redis cache)
│   │   ├── config/       # Environment configuration
│   │   ├── db/           # Database layer (SQLite)
│   │   ├── middleware/   # HTTP middleware
│   │   ├── routes/       # API routes
│   │   ├── services/     # Business logic
│   │   └── types/        # Type definitions
│   ├── Cargo.toml
│   └── Dockerfile.*
├── frontend/              # Next.js frontend
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   └── lib/          # Utilities and hooks
│   ├── package.json
│   └── next.config.js
├── docker-compose.yml     # Base Docker Compose
├── docker-compose.dev.yml # Development overrides
├── docker-compose.prod.yml # Production overrides
└── Makefile              # Development automation
```

## Key Configuration Files

### Backend Configuration

- `backend/.env.dev` / `backend/.env.prod` - Environment variables
- `backend/src/config.rs` - Configuration parsing and validation
- `backend/src/main.rs` - Application entry point with async initialization

### Frontend Configuration

- `frontend/.env.development` / `frontend/.env.production` - Environment variables
- `frontend/next.config.js` - Next.js configuration with API rewrites
- `frontend/tsconfig.json` - TypeScript configuration with path aliases

## Development Workflow

### Environment Setup

1. **Development Environment**:

   ```bash
   make setup-dev
   # Edit backend/.env.dev and frontend/.env.development with actual values
   make dev
   ```

2. **Production Environment**:
   ```bash
   make setup-prod
   # Edit backend/.env.prod and frontend/.env.production with secure values
   make prod
   ```

### Key Development URLs

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health

## Architecture Patterns

### Backend Architecture

- **Config-driven**: All configuration loaded from environment variables
- **Async-first**: Uses Tokio runtime for async operations
- **Layered architecture**: Routes → Services → Database
- **Error handling**: Centralized error types with HTTP response mapping

### Frontend Architecture

- **App Router**: Next.js 14 App Router with server components
- **TypeScript**: Strict type checking with path aliases
- **API Integration**: SWR for data fetching with automatic revalidation
- **Authentication**: JWT-based with middleware protection

### Authentication Flow

1. Google OAuth login
2. JWT token generation with CSRF protection
3. Double Submit Cookie pattern for CSRF protection
4. Redis-based session caching (optional)

## Testing

### Backend Tests

```bash
cd backend
cargo test                 # Run all tests
cargo test -- --nocapture # Run with output
```

### Frontend Tests

```bash
cd frontend
bun run test              # Run frontend tests with Vitest
bun run test:watch        # Run tests in watch mode
bun run test:coverage     # Run tests with coverage
```

**Important**: Use `bun run test` instead of `bun test` to ensure proper Vitest execution.

## Docker Development

### Development Features

- **Hot reloading**: Code changes automatically restart services
- **Volume mounts**: Host code synchronized with containers
- **Debug logging**: Detailed logs for troubleshooting
- **Dependency caching**: Optimized build times

### Production Features

- **Multi-stage builds**: Minimal runtime images
- **Security hardening**: Non-root user execution
- **Health checks**: Service status monitoring
- **Performance optimization**: Native CPU targeting

## Environment Variables

### Backend Required Variables

```bash
DATABASE_URL=sqlite:///app/data/data.db
JWT_SECRET=your_secure_jwt_secret
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
PORT=8080
```

### Frontend Required Variables

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id
NODE_ENV=development
PORT=3000
```

## Troubleshooting

### Common Issues

- **Port conflicts**: Check if ports 8080/3000 are in use
- **Environment variables**: Ensure .env files are properly configured
- **Docker cache**: Use `--no-cache` flag for clean rebuilds
- **Hot reloading**: Verify volume mounts in development

### Debug Commands

```bash
# Check service status
make status

# View logs
make logs
make backend-logs
make frontend-logs

# Enter containers for debugging
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec backend sh
docker-compose -f docker-compose.yml -f docker-compose.dev.yml exec frontend sh
```

## Security Considerations

- JWT secrets must be changed in production
- Google OAuth credentials require proper configuration
- CSRF protection is implemented via Double Submit Cookie
- CORS is configured for frontend-backend communication
- Environment variables are validated at startup

## Performance Optimizations

- **Backend**: Async operations with Tokio runtime
- **Frontend**: Next.js App Router with React Server Components
- **Caching**: Redis integration for session and query caching
- **Build optimization**: Multi-stage Docker builds for minimal images
