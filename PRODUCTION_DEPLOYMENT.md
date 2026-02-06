# 🚀 Production Deployment Package

Complete production-ready deployment package for Leads & Quotes SaaS.

---

## 📦 What's Included

### 1. Docker Configuration
- **Dockerfile** - Multi-stage production build with optimization
- **docker-compose.yml** - Production orchestration (Node + PostgreSQL)
- **docker-compose.dev.yml** - Development override with hot-reload
- **.dockerignore** - Optimized build context

### 2. Health Check System
- **GET /api/v1/health** - Comprehensive health check (DB + Anthropic API)
- **GET /api/v1/health/readiness** - Kubernetes readiness probe
- **GET /api/v1/health/liveness** - Kubernetes liveness probe

### 3. CI/CD Pipeline
- **.github/workflows/deploy.yml** - Automated testing and deployment
  - Runs E2E tests on every push to main
  - Builds Docker image only if tests pass
  - Pushes to GitHub Container Registry
  - Security scanning with Trivy

### 4. Configuration
- **config/env.production.example** - Production environment template
- **Makefile** - Convenient deployment commands

### 5. Documentation
- **DEPLOYMENT.md** - Complete deployment guide
- **PRODUCTION_DEPLOYMENT.md** - This file

---

## ⚡ Quick Start (30 seconds)

```bash
# 1. Copy environment template
cp config/env.production.example .env

# 2. Edit with your credentials
nano .env
# Required: ANTHROPIC_API_KEY, DATABASE_URL

# 3. Start services
make deploy

# 4. Check health
make health
```

**That's it!** Your application is running at http://localhost:3000

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                       │
│                    (Nginx / ALB)                        │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
┌───────▼─────┐   ┌───────▼─────┐
│   App       │   │   App       │
│ Instance 1  │   │ Instance 2  │
│ (Docker)    │   │ (Docker)    │
└────┬────────┘   └────┬────────┘
     │                 │
     └────────┬────────┘
              │
     ┌────────▼────────┐
     │   PostgreSQL    │
     │   (Persistent)  │
     └─────────────────┘
```

---

## 🔧 Available Commands

```bash
# Production
make deploy          # Full deployment (build + migrate + start)
make build           # Build Docker images
make start           # Start services
make stop            # Stop services
make logs            # View logs
make health          # Check health
make backup          # Backup database
make restore FILE=x  # Restore database
make scale N=5       # Scale to N instances

# Development
make dev             # Start dev environment (hot-reload)
make test            # Run E2E tests
make migrate         # Run migrations
make seed            # Seed test data

# Maintenance
make clean           # Remove containers/volumes
make update          # Update dependencies
make scan            # Security scan
```

---

## 📊 Health Check Response

### Healthy System
```json
{
  "status": "healthy",
  "timestamp": "2026-02-05T12:00:00.000Z",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "up",
      "responseTime": 5
    },
    "anthropic": {
      "status": "up",
      "responseTime": 234
    }
  }
}
```

### Degraded System
```json
{
  "status": "degraded",
  "checks": {
    "database": { "status": "up" },
    "anthropic": {
      "status": "down",
      "error": "API key invalid"
    }
  }
}
```

---

## 🚦 CI/CD Pipeline

### Workflow Stages

```
┌─────────────┐
│   Push to   │
│    main     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Run Tests  │──┐
│  (E2E + DB) │  │ FAIL → ❌ Stop
└──────┬──────┘  │
       │ PASS    │
       ▼         │
┌─────────────┐  │
│   Security  │──┤
│    Scan     │  │
└──────┬──────┘  │
       │ PASS    │
       ▼         │
┌─────────────┐  │
│    Build    │  │
│   Docker    │  │
└──────┬──────┘  │
       │         │
       ▼         │
┌─────────────┐  │
│    Push     │  │
│   to GHCR   │  │
└──────┬──────┘  │
       │         │
       ▼         │
┌─────────────┐  │
│   Deploy    │◄─┘
│ (Optional)  │
└─────────────┘
```

### Test Requirements

All tests must pass before deployment:
- ✅ Golden Path (complete conversation)
- ✅ Ghost Buster Recovery
- ✅ Red Alert Path (emergency)
- ✅ Cross-Tenant Sabotage (security)
- ✅ 2:00 AM Silence (timezone)
- ✅ Math Correction (validation)
- ✅ Prompt Injection Defense (security)

---

## 🔐 Security Features

### Application Security
- ✅ Multi-tenant row-level isolation
- ✅ Prompt injection detection
- ✅ Input sanitization (2000 char limit)
- ✅ Message cap enforcement (10 per session)
- ✅ SQL injection protection (parameterized queries)
- ✅ Rate limiting (configurable)
- ✅ CORS restrictions

### Container Security
- ✅ Non-root user (nodejs:1001)
- ✅ Multi-stage build (minimal attack surface)
- ✅ No development dependencies in production
- ✅ Trivy security scanning
- ✅ Health checks enabled

### Network Security
- ✅ Internal network isolation
- ✅ SSL/TLS support (nginx reverse proxy)
- ✅ Environment variable secrets
- ✅ No hardcoded credentials

---

## 📈 Scaling Options

### Horizontal Scaling

```bash
# Docker Compose (single server)
docker-compose up -d --scale app=5

# Kubernetes (multi-server)
kubectl scale deployment leads-quotes-app --replicas=10

# AWS ECS
aws ecs update-service --desired-count 10
```

### Vertical Scaling

Update resource limits in docker-compose.yml:
```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
```

---

## 💰 Cost Estimates

### Small Deployment (50 customers)
- **Infrastructure**: $80-150/month
- **Anthropic API**: $13.50/month (50 × $0.27)
- **Total**: ~$100-170/month

### Medium Deployment (500 customers)
- **Infrastructure**: $200-400/month
- **Anthropic API**: $135/month
- **Total**: ~$335-535/month

### Enterprise (5,000 customers)
- **Infrastructure**: $800-1500/month
- **Anthropic API**: $1,350/month
- **Total**: ~$2,150-2,850/month

**ROI**: Average customer generates $3,000-5,000 in recovered revenue

---

## 🌍 Deployment Platforms

### Supported Platforms

| Platform | Difficulty | Cost | Best For |
|----------|-----------|------|----------|
| **Docker Compose** | ⭐ Easy | $ Low | Small scale |
| **AWS ECS/Fargate** | ⭐⭐ Medium | $$ Medium | Production |
| **Kubernetes** | ⭐⭐⭐ Hard | $$$ High | Enterprise |
| **Heroku** | ⭐ Easy | $$ Medium | Quick start |
| **Google Cloud Run** | ⭐⭐ Medium | $ Low | Serverless |
| **DigitalOcean Apps** | ⭐ Easy | $ Low | Startups |

---

## 📝 Environment Variables

### Required (Minimum)
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Recommended (Production)
```bash
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
SENDGRID_API_KEY=SG...
SENTRY_DSN=https://...
```

### Optional (Advanced)
```bash
REDIS_URL=redis://...
AWS_S3_BACKUP_BUCKET=...
WEBHOOK_URL=https://...
```

See `config/env.production.example` for complete list.

---

## 🔧 Troubleshooting

### Database Connection Failed
```bash
# Check database status
docker-compose ps postgres

# View logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -c "SELECT 1"
```

### Anthropic API Errors
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Test API
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"test"}]}'
```

### Health Check Failing
```bash
# Check all endpoints
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/readiness
curl http://localhost:3000/api/v1/health/liveness

# View detailed logs
docker-compose logs app | grep -i error
```

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process or change PORT in .env
```

---

## 📚 Additional Resources

- **Deployment Guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Production Hardening**: [PRODUCTION_HARDENING_SUMMARY.md](PRODUCTION_HARDENING_SUMMARY.md)
- **E2E Testing**: [E2E_TESTING_GUIDE.md](E2E_TESTING_GUIDE.md)
- **GitHub Repository**: https://github.com/John-Dixon-IV/leads-and-quotes

---

## 🎯 Next Steps

1. **Configure Environment**: Edit `.env` with your credentials
2. **Run Tests**: `make test` to ensure everything works
3. **Deploy**: `make deploy` to start production
4. **Monitor**: Set up health check monitoring
5. **Scale**: Increase instances as you grow

---

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/John-Dixon-IV/leads-and-quotes/issues)
- **Discussions**: [GitHub Discussions](https://github.com/John-Dixon-IV/leads-and-quotes/discussions)

---

**Status**: ✅ Production Ready

Last Updated: 2026-02-05
