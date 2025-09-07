# Young Buddha Web Makefile
# Provides convenient commands for development and production workflows

.PHONY: help dev prod stop clean logs backend frontend build \
	prod-build prod-push prod-pull prod-up prod-down prod-build-push prod-pull-up \
	init-dev init-prod setup-dev setup-prod clean-frontend clean-backend clean-docker clean-all

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
	@echo "  make init-dev     Alias of setup-dev"
	@echo "  make init-prod    Alias of setup-prod"
	@echo "  make test-backend Run backend tests"
	@echo "  make test-frontend Run frontend tests"
	@echo "  make help         Show this help message"
	@echo ""
	@echo "Environment setup:"
	@echo "  make setup-dev    - Creates .env.dev files from examples"
	@echo "  make setup-prod   - Creates .env.prod files from examples"
	@echo ""
	@echo "Clean commands:"
	@echo "  make clean-frontend  - Clean frontend dependencies and build cache"
	@echo "  make clean-backend   - Clean backend build cache and dependencies"
	@echo "  make clean-docker    - Clean Docker containers, images, and volumes"
	@echo "  make clean-all       - Clean everything (frontend + backend + docker)"
	@echo ""
	@echo "Docker build/push/pull:"
	@echo "  make prod-build   Build images with docker-compose.prod.yml"
	@echo "  make prod-push    Push built images to registry"
	@echo "  make prod-pull    Pull images from registry"
	@echo "  make prod-up      Run production stack (detached)"
	@echo "  make prod-down    Stop production stack"
	@echo "  make prod-build-push Build and push production images"
	@echo "  make prod-pull-up   Pull images and start production stack"

# Development environment
dev:
	@echo "🚀 Starting development environment..."
	@if ! docker info > /dev/null 2>&1; then \
		echo "❌ Docker is not running. Please start Docker and try again."; \
		exit 1; \
	fi
	@if [ ! -f "backend/.env.dev" ]; then \
		echo "⚠️  backend/.env.dev not found. Creating from example..."; \
		cp backend/.env.example backend/.env.dev; \
		echo "📝 Please edit backend/.env.dev with your actual values"; \
	fi
	@if [ ! -f "frontend/.env.development" ]; then \
		echo "⚠️  frontend/.env.development not found. Creating from example..."; \
		cp frontend/.env.example frontend/.env.development; \
		echo "📝 Please edit frontend/.env.development with your actual values"; \
	fi
	@echo "📦 Building and starting development containers..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
	@echo "✅ Development environment started!"
	@echo "🌐 Backend API: http://localhost:8080"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "📊 Health check: http://localhost:8080/health"

# Production environment
prod:
	@echo "🚀 Starting production environment..."
	@if ! docker info > /dev/null 2>&1; then \
		echo "❌ Docker is not running. Please start Docker and try again."; \
		exit 1; \
	fi
	@if [ ! -f "backend/.env.prod" ]; then \
		echo "❌ backend/.env.prod not found. Please create it from the example:"; \
		echo "   cp backend/.env.example backend/.env.prod"; \
		echo "   Then edit with your production values"; \
		exit 1; \
	fi
	@if [ ! -f "frontend/.env.production" ]; then \
		echo "❌ frontend/.env.production not found. Please create it from the example:"; \
		echo "   cp frontend/.env.example frontend/.env.production"; \
		echo "   Then edit with your production values"; \
		exit 1; \
	fi
	@if grep -q "your_very_secure_jwt_secret_here" backend/.env.prod; then \
		echo "❌ ERROR: Please change the default JWT_SECRET in backend/.env.prod"; \
		echo "   Using default secrets in production is a security risk!"; \
		exit 1; \
	fi
	@echo "📦 Building production containers (this may take a while)..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
	@echo "🚀 Starting production services in detached mode..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
	@echo "⏳ Waiting for services to start..." && sleep 3
	@echo "📊 Checking service status..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml ps || true
	@NAME=young-buddha-backend-prod; \
	echo "🔎 Waiting for backend health (up to 60s)..."; \
	for i in {1..12}; do \
		STATUS=$$(docker inspect -f '{{ .State.Health.Status }}' "$$NAME" 2>/dev/null || echo unknown); \
		echo " - backend health: $$STATUS ($$i/12)"; \
		if [ "$$STATUS" = "healthy" ]; then \
			echo "✅ Backend is healthy"; \
			break; \
		fi; \
		if [ "$$STATUS" = "unhealthy" ] || [ "$$STATUS" = "restarting" ] || [ "$$STATUS" = "exited" ]; then \
			echo "📌 Backend logs (last 80 lines):"; \
			docker logs --tail=80 "$$NAME" 2>&1 || true; \
		fi; \
		sleep 5; \
	done; \
	FINAL=$$(docker inspect -f '{{ .State.Health.Status }}' "$$NAME" 2>/dev/null || echo unknown); \
	if [ "$$FINAL" != "healthy" ]; then \
		echo "❌ Backend failed to become healthy. Dumping diagnostics..."; \
		docker compose -f docker-compose.yml -f docker-compose.prod.yml ps || true; \
		echo "📌 Backend logs (last 200 lines):"; \
		docker logs --tail=200 "$$NAME" 2>&1 || true; \
		echo "🔍 Tip: set RUST_LOG=debug in backend/.env.prod to increase verbosity."; \
		exit 1; \
	fi
	@echo "✅ Production environment started successfully!"
	@echo "🌐 Backend API: http://localhost:8080"
	@echo "🌐 Frontend: http://localhost:3000"
	@echo "📊 Health check: http://localhost:8080/health"
	@echo ""
	@echo "📋 Useful commands:"
	@echo "   View logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs"
	@echo "   View backend logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs backend"
	@echo "   View frontend logs: docker compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend"
	@echo "   Stop services: docker compose -f docker-compose.yml -f docker-compose.prod.yml down"
	@echo ""
	@echo "🔒 Remember to:"
	@echo "   - Use HTTPS in production"
	@echo "   - Set up proper SSL certificates"
	@echo "   - Configure firewall rules"
	@echo "   - Set up monitoring and alerts"

# Stop all containers
stop:
	@echo "🛑 Stopping all containers..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml down 2>/dev/null || true
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml down 2>/dev/null || true

# Clean - stop and remove all containers and volumes
clean:
	@echo "🧹 Cleaning up containers and volumes..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v 2>/dev/null || true
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml down -v 2>/dev/null || true

# Clean commands (new)
clean-frontend:
	@echo "🧹 Cleaning frontend..."
	@cd frontend && rm -rf node_modules .next out dist build
	@cd frontend && rm -f package-lock.json yarn.lock bun.lockb
	@echo "✅ Frontend cleaned!"

clean-backend:
	@echo "🧹 Cleaning backend..."
	@cd backend && rm -rf target Cargo.lock
	@cd backend && cargo clean 2>/dev/null || true
	@echo "✅ Backend cleaned!"

clean-docker:
	@echo "🧹 Cleaning Docker..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml down --volumes --remove-orphans 2>/dev/null || true
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml down --volumes --remove-orphans 2>/dev/null || true
	@docker system prune -f
	@docker volume prune -f
	@echo "✅ Docker cleaned!"

clean-all: clean-frontend clean-backend clean-docker
	@echo "🎉 Everything cleaned!"

# View logs
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f

# Start only backend
backend:
	@echo "🔧 Starting backend service..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build backend

# Start only frontend
frontend:
	@echo "🎨 Starting frontend service..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build frontend

# Build containers without starting
build:
	@echo "🔨 Building containers..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml build
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Backend specific commands
backend-logs:
	@echo "📋 Showing backend logs..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f backend 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f backend

frontend-logs:
	@echo "📋 Showing frontend logs..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f frontend 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml logs -f frontend

# Restart services
restart:
	@echo "🔄 Restarting services..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml restart 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml restart

restart-backend:
	@echo "🔄 Restarting backend..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml restart backend 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend

restart-frontend:
	@echo "🔄 Restarting frontend..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml restart frontend 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml restart frontend

# Status check
status:
	@echo "📊 Container status:"
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml ps 2>/dev/null || \
	docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

## Environment setup helpers (development)
setup-dev:
	@echo "⚙️ Setting up development environment..."
	@if [ ! -f "backend/.env.dev" ]; then \
		if [ -f "backend/.env.example" ]; then cp backend/.env.example backend/.env.dev; \
		else touch backend/.env.dev; fi; \
		echo "✅ Created backend/.env.dev - please edit with your values"; \
	else \
		echo "❗️ backend/.env.dev already exists"; \
	fi
	@if [ ! -f "frontend/.env.development" ]; then \
		if [ -f "frontend/.env.example" ]; then cp frontend/.env.example frontend/.env.development; \
		else touch frontend/.env.development; fi; \
		echo "✅ Created frontend/.env.development - please edit with your values"; \
	else \
		echo "❗️ frontend/.env.development already exists"; \
	fi

## Environment setup helpers (production)
setup-prod:
	@echo "⚙️ Setting up production environment..."
	@if [ ! -f "backend/.env.prod" ]; then \
		if [ -f "backend/.env.prod.example" ]; then cp backend/.env.prod.example backend/.env.prod; \
		else cp backend/.env.example backend/.env.prod; fi; \
		echo "✅ Created backend/.env.prod - please edit with SECURE values"; \
	else \
		echo "❗️ backend/.env.prod already exists"; \
	fi

# Aliases
init-dev: setup-dev
init-prod: setup-prod
	@if [ ! -f "frontend/.env.production" ]; then \
		if [ -f "frontend/.env.prod.example" ]; then cp frontend/.env.prod.example frontend/.env.production; \
		else cp frontend/.env.example frontend/.env.production; fi; \
		echo "✅ Created frontend/.env.production - please edit with your values"; \
	else \
		echo "❗️ frontend/.env.production already exists"; \
	fi

# Production build/push/pull commands
prod-build:
	@echo "🔨 Building production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml build

prod-push:
	@echo "📤 Pushing production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml push

prod-pull:
	@echo "📥 Pulling production images..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml pull

prod-up:
	@echo "🚀 Starting production stack (detached)..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
	@echo "✅ Production stack started in detached mode"

prod-down:
	@echo "🔴 Stopping production stack..."
	@docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Combined commands
prod-build-push: prod-build prod-push
	@echo "✅ Production images built and pushed successfully"

prod-pull-up: prod-pull prod-up
	@echo "✅ Production images pulled and stack started successfully"

# Quick test commands
test-backend:
	@echo "🧪 Testing backend..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm backend cargo test

test-frontend:
	@echo "🧪 Testing frontend..."
	@docker compose -f docker-compose.yml -f docker-compose.dev.yml run --rm frontend bun run test
