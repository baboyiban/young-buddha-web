#!/bin/bash

# Young Buddha Web Development Startup Script
set -e

echo "🚀 Starting Young Buddha Web in development mode..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if environment files exist
if [ ! -f "backend/.env.dev" ]; then
    echo "⚠️  backend/.env.dev not found. Creating from example..."
    cp backend/.env.example backend/.env.dev
    echo "📝 Please edit backend/.env.dev with your actual values"
fi

if [ ! -f "frontend/.env.development" ]; then
    echo "⚠️  frontend/.env.development not found. Creating from example..."
    cp frontend/.env.example frontend/.env.development
    echo "📝 Please edit frontend/.env.development with your actual values"
fi

# Build and start services
echo "📦 Building and starting development containers..."
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build

echo "✅ Development environment started!"
echo "🌐 Backend API: http://localhost:8080"
echo "🌐 Frontend: http://localhost:3000"
echo "📊 Health check: http://localhost:8080/health"
