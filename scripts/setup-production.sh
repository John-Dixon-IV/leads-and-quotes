#!/bin/bash

# ============================================
# Production Setup Script
# ============================================
# Quick setup script for deploying Leads & Quotes

set -e  # Exit on error

echo "================================================"
echo "Leads & Quotes - Production Setup"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Install Docker from: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Install Docker Compose from: https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker is installed${NC}"
echo -e "${GREEN}✓ Docker Compose is installed${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    if [ -f config/env.production.example ]; then
        cp config/env.production.example .env
        echo -e "${GREEN}✓ .env file created${NC}"
        echo ""
        echo -e "${YELLOW}IMPORTANT: Edit .env and add your credentials!${NC}"
        echo ""
        echo "Required variables:"
        echo "  - ANTHROPIC_API_KEY"
        echo "  - DATABASE_URL (or DB_USER, DB_PASSWORD, etc.)"
        echo ""
        read -p "Press Enter when you've configured .env..."
    else
        echo -e "${RED}Error: config/env.production.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Validate required environment variables
echo ""
echo "Validating environment variables..."

source .env

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}Error: ANTHROPIC_API_KEY is not set${NC}"
    exit 1
fi

echo -e "${GREEN}✓ ANTHROPIC_API_KEY is set${NC}"

# Check database configuration
if [ -z "$DATABASE_URL" ] && [ -z "$DB_USER" ]; then
    echo -e "${RED}Error: Database configuration missing${NC}"
    echo "Set either DATABASE_URL or DB_USER/DB_PASSWORD/DB_NAME"
    exit 1
fi

echo -e "${GREEN}✓ Database configuration is set${NC}"
echo ""

# Build Docker images
echo "Building Docker images..."
docker-compose build

echo -e "${GREEN}✓ Docker images built${NC}"
echo ""

# Start services
echo "Starting services..."
docker-compose up -d

echo -e "${GREEN}✓ Services started${NC}"
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check health
echo "Checking application health..."
for i in {1..30}; do
    if curl -s http://localhost:3000/api/v1/health/liveness &> /dev/null; then
        echo -e "${GREEN}✓ Application is healthy${NC}"
        break
    fi

    if [ $i -eq 30 ]; then
        echo -e "${RED}Error: Application health check failed${NC}"
        echo "Check logs with: docker-compose logs app"
        exit 1
    fi

    echo "  Waiting... ($i/30)"
    sleep 2
done

echo ""

# Run migrations
echo "Running database migrations..."
docker-compose exec -T app npm run migrate

echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Optional: Seed data
read -p "Seed database with test data? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Seeding database..."
    docker-compose exec -T app npm run db:seed
    echo -e "${GREEN}✓ Database seeded${NC}"
fi

echo ""
echo "================================================"
echo -e "${GREEN}✓ Setup Complete!${NC}"
echo "================================================"
echo ""
echo "Application is running at:"
echo "  - API: http://localhost:3000"
echo "  - Health: http://localhost:3000/api/v1/health"
echo ""
echo "Useful commands:"
echo "  make logs     - View application logs"
echo "  make health   - Check health status"
echo "  make stop     - Stop services"
echo "  make restart  - Restart services"
echo ""
echo "View full deployment guide: DEPLOYMENT.md"
echo ""
