.PHONY: help build start stop restart logs clean test deploy health migrate seed

# Default target
help:
	@echo "Leads & Quotes - Production Deployment"
	@echo ""
	@echo "Available commands:"
	@echo "  make build       - Build Docker images"
	@echo "  make start       - Start all services"
	@echo "  make stop        - Stop all services"
	@echo "  make restart     - Restart all services"
	@echo "  make logs        - View application logs"
	@echo "  make health      - Check application health"
	@echo "  make test        - Run E2E tests"
	@echo "  make migrate     - Run database migrations"
	@echo "  make seed        - Seed database with test data"
	@echo "  make clean       - Remove containers and volumes"
	@echo "  make deploy      - Deploy to production"
	@echo "  make dev         - Start development environment"

# Build Docker images
build:
	docker-compose build --no-cache

# Start services
start:
	docker-compose up -d
	@echo "Services started. Check health at http://localhost:3000/api/v1/health"

# Stop services
stop:
	docker-compose down

# Restart services
restart:
	docker-compose restart

# View logs
logs:
	docker-compose logs -f app

# Check health
health:
	@curl -s http://localhost:3000/api/v1/health | jq '.'

# Run tests
test:
	npm run test:e2e

# Run database migrations
migrate:
	docker-compose exec app npm run migrate

# Seed database
seed:
	docker-compose exec app npm run db:seed

# Clean everything
clean:
	docker-compose down -v
	rm -rf data/postgres
	rm -rf logs/*

# Full deploy (build, migrate, start)
deploy:
	@echo "Deploying to production..."
	docker-compose build
	docker-compose up -d
	sleep 10
	docker-compose exec app npm run migrate
	@echo "Deployment complete!"
	@make health

# Development environment
dev:
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production deployment
prod:
	docker-compose -f docker-compose.yml up -d --build
	@echo "Production deployed!"
	@make health

# Database backup
backup:
	@mkdir -p backups
	docker-compose exec -T postgres pg_dump -U postgres leads_and_quotes | gzip > backups/backup-$$(date +%Y%m%d-%H%M%S).sql.gz
	@echo "Backup created in backups/"

# Database restore (Usage: make restore FILE=backup-20260205-120000.sql.gz)
restore:
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backup.sql.gz"; exit 1; fi
	gunzip -c backups/$(FILE) | docker-compose exec -T postgres psql -U postgres leads_and_quotes
	@echo "Restore complete!"

# Scale app instances (Usage: make scale N=3)
scale:
	@if [ -z "$(N)" ]; then echo "Usage: make scale N=3"; exit 1; fi
	docker-compose up -d --scale app=$(N)
	@echo "Scaled to $(N) instances"

# View resource usage
stats:
	docker stats --no-stream

# Security scan
scan:
	trivy image leads-quotes-app:latest

# Update dependencies
update:
	npm update
	npm audit fix
	docker-compose build

# Generate SSL certificates (Let's Encrypt)
ssl:
	certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
	@echo "Certificates generated in /etc/letsencrypt/live/yourdomain.com/"
