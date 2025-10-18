# Young Buddha Web Makefile
# Provides convenient commands for development and production workflows.

# Use .DEFAULT_GOAL to make `help` the default action when `make` is run without arguments.
.DEFAULT_GOAL := help

# Define variables for docker-compose commands to reduce repetition.
DC_DEV = docker compose -f docker-compose.yml -f docker-compose.dev.yml
DC_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

# Phony targets are not files. This prevents `make` from getting confused if a file with the same name exists.
.PHONY: help dev prod stop logs build test lint clean
.PHONY: backend frontend
.PHONY: setup-dev setup-prod
.PHONY: test-backend test-frontend
.PHONY: lint-backend lint-frontend
.PHONY: clean-backend clean-frontend clean-docker
.PHONY: prod-up prod-down prod-build prod-push prod-pull

# ====================================================================================
# HELP - This will be the default target.
# ====================================================================================

help: ## ✨ Show this help message.
	@awk 'BEGIN {FS = ":.*?## "; printf "\nUsage:\n  make \033[36m<target>\033[0m\n\nTargets:\n"} /^[a-zA-Z_\-]+:.*?##/ { printf "  \033[36m%%-20s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ====================================================================================
# DEVELOPMENT
# ====================================================================================

dev: setup-dev ## 🚀 Start the development environment (backend + frontend).
	@echo "🚀 Starting development environment..."
	@$(DC_DEV) up --build

backend: setup-dev ## 🔧 Start only the backend service in development mode.
	@echo "🔧 Starting backend service..."
	@$(DC_DEV) up --build backend

frontend: setup-dev ## 🎨 Start only the frontend service in development mode.
	@echo "🎨 Starting frontend service..."
	@$(DC_DEV) up --build frontend

# ====================================================================================
# PRODUCTION
# ====================================================================================

prod: prod-up ## 🚀 Start the production environment (alias for prod-up).

prod-up: setup-prod ## 🚀 Build and start the production environment in detached mode.
	@echo "🚀 Starting production environment..."
	@$(DC_PROD) up -d --build --remove-orphans
	@echo "✅ Production environment started!"
	@echo "📋 Use 'make logs' or 'make status' to check the status."

prod-down: ## 🔴 Stop the production environment.
	@echo "🔴 Stopping production stack..."
	@$(DC_PROD) down

prod-build: ## 🔨 Build production images.
	@echo "🔨 Building production images..."
	@$(DC_PROD) build

prod-push: ## 📤 Push production images to a container registry.
	@echo "📤 Pushing production images..."
	@$(DC_PROD) push

prod-pull: ## 📥 Pull production images from a container registry.
	@echo "📥 Pulling production images..."
	@$(DC_PROD) pull

# ====================================================================================
# GENERAL COMMANDS
# ====================================================================================

stop: ## 🛑 Stop all running containers (dev and prod).
	@echo "🛑 Stopping all containers..."
	@$(DC_DEV) down -v --remove-orphans 2>/dev/null || true
	@$(DC_PROD) down -v --remove-orphans 2>/dev/null || true

logs: ## 📋 View logs from all running services.
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	@$(DC_DEV) logs -f 2>/dev/null || $(DC_PROD) logs -f

build: ## 🔨 Build all development containers without starting.
	@echo "🔨 Building development containers..."
	@$(DC_DEV) build

status: ## 📊 Show the status of running containers.
	@echo "📊 Container status:"
	@$(DC_DEV) ps 2>/dev/null || $(DC_PROD) ps

# ====================================================================================
# TESTING & LINTING
# ====================================================================================

test: test-backend test-frontend ## 🧪 Run all tests (backend + frontend).

lint: lint-backend lint-frontend ## 🔍 Run all linters (backend + frontend).

test-backend: ## 🧪 Run backend tests inside a Docker container.
	@echo "🧪 Testing backend..."
	@$(DC_DEV) run --rm backend cargo test

lint-backend: ## 🔍 Lint backend code with clippy.
	@echo "🔍 Linting backend (clippy)..."
	@$(DC_DEV) run --rm backend cargo clippy -- -D warnings

test-frontend: ## 🧪 Run frontend tests locally.
	@echo "🧪 Testing frontend..."
	@cd frontend && npx vitest run

lint-frontend: ## 🔍 Lint frontend code with ESLint.
	@echo "🔍 Linting frontend (eslint)..."
	@cd frontend && npx eslint .

# ====================================================================================
# SETUP & CLEANING
# ====================================================================================

setup-dev: ## ⚙️ Create .env files for development if they don't exist.
	@echo "⚙️ Setting up development environment files..."
	@test -f backend/.env.dev || cp backend/.env.example backend/.env.dev
	@test -f frontend/.env.example || cp frontend/.env.example frontend/.env.development

setup-prod: ## ⚙️ Create .env files for production if they don't exist.
	@echo "⚙️ Setting up production environment files..."
	@test -f backend/.env.prod || cp backend/.env.example backend/.env.prod
	@test -f frontend/.env.production || cp frontend/.env.example frontend/.env.production

clean: clean-docker clean-backend clean-frontend ## 🧹 Clean everything (Docker, build caches, etc.).
	@echo "🎉 Everything is clean!"

clean-docker: stop ## 🧹 Stop and remove all Docker containers, networks, and volumes.
	@echo "🧹 Cleaning Docker..."
	@docker system prune -af
	@docker volume prune -f

clean-backend: ## 🧹 Clean the backend build cache.
	@echo "🧹 Cleaning backend..."
	@cd backend && cargo clean

clean-frontend: ## 🧹 Clean frontend dependencies and build cache.
	@echo "🧹 Cleaning frontend..."
	@rm -rf frontend/node_modules frontend/.next frontend/out