# Young Buddha Web Makefile
# Provides convenient commands for development and production workflows

.PHONY: help dev prod stop clean logs backend frontend build \
	prod-build prod-push prod-pull prod-up prod-down

# Default target
help:
	@echo "Young Buddha Web - Development Makefile"
	@echo ""
	@echo "Usage:"
	@echo "  make dev          Start development environment"
	@echo "  make prod         Start production environment"
	@echo "  make stop         Stop all running containers"
	@echo "  make clean        Stop and remove all containers and volumes"
	@echo "  make logs         View logs from all services"
	@echo "  make backend      Start only backend service"
	@echo "  make frontend     Start only frontend service"
	@echo "  make build        Build containers without starting"
	@echo "  make setup-dev    Setup development environment files"
	@echo "  make setup-prod   Setup production environment files"
	@echo "  make test-backend Run backend tests"
	@echo "  make test-frontend Run frontend tests"
	@echo "  make help         Show this help message"
	@echo ""
	@echo "Environment setup:"
	@echo "  make setup-dev    - Creates .env.dev files from examples"
	@echo "  make setup-prod   - Creates .env.prod files from examples"
	@echo ""
	@echo "Docker build/push/pull:"
	@echo "  make prod-build   Build images with docker-compose.prod.yml"
	@echo "  make prod-push    Push built images to registry"
	@echo "  make prod-pull    Pull images from registry"
	@echo "  make prod-up      Run production stack (detached)"
	@echo "  make prod-down    Stop production stack"

# Development environment
dev:
	@echo "🚀 Starting development environment..."
	@./scripts/dev.sh

# Production environment
prod:
	@echo "🚀 Starting production environment..."
	@./scripts/prod.sh

# Stop all containers
stop:
	@echo "🛑 Stopping all containers..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true

# Clean - stop and remove all containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>/dev/null || true
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml down -v 2>/dev/null || true

# View logs
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Start only backend
backend:
	@echo "🔧 Starting backend service..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend

# Start only frontend
frontend:
	@echo "🎨 Starting frontend service..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend

# Build containers without starting
build:
	@echo "🔨 Building containers..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml build
	@docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Backend specific commands
backend-logs:
	@echo "📋 Showing backend logs..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

frontend-logs:
	@echo "📋 Showing frontend logs..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend

# Restart services
restart:
	@echo "🔄 Restarting services..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart

restart-backend:
	@echo "🔄 Restarting backend..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart backend 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

restart-frontend:
	@echo "🔄 Restarting frontend..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml restart frontend 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend

# Status check
status:
	@echo "📊 Container status:"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml ps 2>/dev/null || \
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Environment setup helpers
setup-prod:
	@echo "⚙️ Setting up development environment..."
	@if [ ! -f "backend/.env.prod" ]; then \
		if [ -f "backend/.env.prod.example" ]; then cp backend/.env.prod.example backend/.env.prod; \
		else cp backend/.env.example backend/.env.prod; fi; \
		echo "✅ Created backend/.env.dev - please edit with your values"; \
	else \
		echo "ℹ️ backend/.env.dev already exists"; \
	fi
	@if [ ! -f "frontend/.env.production" ]; then \
		if [ -f "frontend/.env.prod.example" ]; then cp frontend/.env.prod.example frontend/.env.production; \
		else cp frontend/.env.example frontend/.env.production; fi; \
		echo "✅ Created frontend/.env.development - please edit with your values"; \
	else \
		echo "ℹ️ frontend/.env.development already exists"; \
	fi

# Compose (production) helpers using docker compose v2 syntax
prod-build:
	@echo "\ud83d\udd28 Building production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-push:
	@echo "\ud83d\udcbe Pushing production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml push

prod-pull:
	@echo "\ud83d\udcbe Pulling production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

prod-up:
	@echo "\ud83d\ude80 Starting production stack (detached)..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

prod-down:
	@echo "\ud83d\uded1 Stopping production stack..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml down

setup-prod:
	@echo "⚙️ Setting up production environment..."
	@if [ ! -f "backend/.env.prod" ]; then \
		cp backend/.env.example backend/.env.prod; \
		echo "✅ Created backend/.env.prod - please edit with SECURE values"; \
	else \
		echo "ℹ️ backend/.env.prod already exists"; \
	fi
	@if [ ! -f "frontend/.env.production" ]; then \
		cp frontend/.env.example frontend/.env.production; \
		echo "✅ Created frontend/.env.production - please edit with your values"; \
	else \
		echo "ℹ️ frontend/.env.production already exists"; \
	fi

# Quick test commands
test-backend:
	@echo "🧪 Testing backend..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend cargo test

test-frontend:
	@echo "🧪 Testing frontend..."
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml run --rm frontend bun run test
