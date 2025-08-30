#!/bin/bash

# Young Buddha Web Production Startup Script
set -e

echo "🚀 Starting Young Buddha Web in production mode..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if production environment files exist
if [ ! -f "backend/.env.prod" ]; then
    echo "❌ backend/.env.prod not found. Please create it from the example:"
    echo "   cp backend/.env.example backend/.env.prod"
    echo "   Then edit with your production values"
    exit 1
fi

if [ ! -f "frontend/.env.production" ]; then
    echo "❌ frontend/.env.production not found. Please create it from the example:"
    echo "   cp frontend/.env.example frontend/.env.production"
    echo "   Then edit with your production values"
    exit 1
fi

# Validate production environment variables
echo "🔍 Validating production environment variables..."

# Check for default JWT secret in production
if grep -q "your_very_secure_jwt_secret_here" backend/.env.prod; then
    echo "❌ ERROR: Please change the default JWT_SECRET in backend/.env.prod"
    echo "   Using default secrets in production is a security risk!"
    exit 1
fi

# Build and start services in detached mode
echo "📦 Building production containers (this may take a while)..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --pull

echo "🚀 Starting production services in detached mode..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans

# Wait a moment for services to start
echo "⏳ Waiting for services to start..."
sleep 5

# Check service status
echo "📊 Checking service status..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

echo "✅ Production environment started successfully!"
echo "🌐 Backend API: http://localhost:8080"
echo "🌐 Frontend: http://localhost:3000"
echo "📊 Health check: http://localhost:8080/health"
echo ""
echo "📋 Useful commands:"
echo "   View logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs"
echo "   View backend logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs backend"
echo "   View frontend logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs frontend"
echo "   Stop services: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo ""
echo "🔒 Remember to:"
echo "   - Use HTTPS in production"
echo "   - Set up proper SSL certificates"
echo "   - Configure firewall rules"
echo "   - Set up monitoring and alerts"
