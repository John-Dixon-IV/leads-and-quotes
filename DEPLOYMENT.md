# Production Deployment Guide

Complete guide for deploying the Leads & Quotes SaaS to production.

---

## Prerequisites

- Docker & Docker Compose installed
- PostgreSQL 16+ (or use Docker Compose)
- Node.js 20+ (for local development)
- Anthropic API key
- (Optional) Twilio account for SMS
- (Optional) SendGrid account for emails

---

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
# Clone repository
git clone https://github.com/John-Dixon-IV/leads-and-quotes.git
cd leads-and-quotes

# Copy environment template
cp config/env.production.example .env

# Edit .env with your credentials
nano .env
```

### 2. Required Environment Variables

**Minimum required:**
```bash
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
DATABASE_URL=postgresql://user:pass@postgres:5432/leads_and_quotes
```

### 3. Start Services

```bash
# Build and start all services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Check health
curl http://localhost:3000/api/v1/health
```

### 4. Run Migrations

```bash
# Run database migrations
docker-compose exec app npm run migrate

# Seed initial data (optional)
docker-compose exec app npm run db:seed
```

### 5. Access Application

- **API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/v1/health
- **Demo Widget**: http://localhost:3000/demo.html

---

## Production Deployment Options

### Option 1: Docker Compose (Single Server)

**Best for:** Small to medium deployments, single server

```bash
# Production compose file
docker-compose -f docker-compose.yml up -d

# Scale app instances (behind load balancer)
docker-compose up -d --scale app=3
```

### Option 2: Kubernetes (EKS, GKE, AKS)

**Best for:** Large scale, high availability

```bash
# Build and push image
docker build -t leads-quotes:latest .
docker push your-registry/leads-quotes:latest

# Apply Kubernetes manifests
kubectl apply -f k8s/
```

### Option 3: Cloud Platforms

#### AWS Elastic Beanstalk
```bash
# Install EB CLI
pip install awsebcli

# Initialize and deploy
eb init -p docker leads-quotes
eb create production-env
eb deploy
```

#### AWS ECS/Fargate
```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name leads-quotes

# Register task definition
aws ecs register-task-definition --cli-input-json file://ecs-task.json

# Create service
aws ecs create-service \
  --cluster leads-quotes \
  --service-name leads-quotes-api \
  --task-definition leads-quotes:1 \
  --desired-count 2
```

#### Google Cloud Run
```bash
# Build and deploy
gcloud builds submit --tag gcr.io/PROJECT_ID/leads-quotes
gcloud run deploy leads-quotes \
  --image gcr.io/PROJECT_ID/leads-quotes \
  --platform managed \
  --region us-central1
```

#### Heroku
```bash
# Login and create app
heroku login
heroku create leads-quotes-prod

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:standard-0

# Deploy
git push heroku main
```

---

## Environment Configuration

### Production Environment Variables

See `config/env.production.example` for complete list.

**Critical settings:**

1. **Database**: Use connection pooling (DB_POOL_MAX=10)
2. **API Keys**: Rotate regularly, store in secrets manager
3. **Session Secret**: Generate strong random string
4. **CORS**: Set ALLOWED_ORIGINS to your domains
5. **Monitoring**: Enable Sentry or CloudWatch

### Secrets Management

**AWS Secrets Manager:**
```bash
# Store secrets
aws secretsmanager create-secret \
  --name leads-quotes/anthropic-key \
  --secret-string "sk-ant-api03-..."

# Access in ECS task definition
{
  "secrets": [
    {
      "name": "ANTHROPIC_API_KEY",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:leads-quotes/anthropic-key"
    }
  ]
}
```

**Kubernetes Secrets:**
```bash
# Create secret
kubectl create secret generic leads-quotes-secrets \
  --from-literal=anthropic-api-key=sk-ant-api03-... \
  --from-literal=db-password=your-password

# Reference in deployment
env:
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: leads-quotes-secrets
        key: anthropic-api-key
```

---

## Database Setup

### PostgreSQL Configuration

**Production settings (postgresql.conf):**
```ini
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 2621kB
min_wal_size = 1GB
max_wal_size = 4GB
```

### Backups

**Automated backups:**
```bash
# Cron job for daily backups
0 2 * * * docker-compose exec -T postgres pg_dump -U postgres leads_and_quotes | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz

# Backup to S3
0 2 * * * docker-compose exec -T postgres pg_dump -U postgres leads_and_quotes | gzip | aws s3 cp - s3://your-bucket/backups/db-$(date +\%Y\%m\%d).sql.gz
```

**Restore from backup:**
```bash
# From local file
gunzip -c backup.sql.gz | docker-compose exec -T postgres psql -U postgres leads_and_quotes

# From S3
aws s3 cp s3://your-bucket/backups/db-20260205.sql.gz - | gunzip | docker-compose exec -T postgres psql -U postgres leads_and_quotes
```

---

## Monitoring & Observability

### Health Checks

```bash
# Comprehensive health check
curl http://localhost:3000/api/v1/health

# Readiness probe (for k8s)
curl http://localhost:3000/api/v1/health/readiness

# Liveness probe
curl http://localhost:3000/api/v1/health/liveness
```

### Logging

**Production logging:**
```bash
# View logs
docker-compose logs -f app

# Export to file
docker-compose logs app > logs/app.log

# CloudWatch (AWS)
aws logs tail /aws/ecs/leads-quotes --follow
```

### Metrics

**Prometheus metrics (optional):**
Add to server.ts:
```typescript
import promClient from 'prom-client';

const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

---

## SSL/TLS Configuration

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /api/v1/health {
        proxy_pass http://localhost:3000/api/v1/health;
        access_log off;
    }
}
```

---

## Scaling & Performance

### Horizontal Scaling

```bash
# Docker Compose
docker-compose up -d --scale app=5

# Kubernetes
kubectl scale deployment leads-quotes-app --replicas=5

# AWS ECS
aws ecs update-service \
  --cluster leads-quotes \
  --service leads-quotes-api \
  --desired-count 5
```

### Load Balancing

**AWS Application Load Balancer:**
```bash
aws elbv2 create-load-balancer \
  --name leads-quotes-alb \
  --subnets subnet-12345 subnet-67890 \
  --security-groups sg-12345

aws elbv2 create-target-group \
  --name leads-quotes-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-12345 \
  --health-check-path /api/v1/health/liveness
```

---

## Security Checklist

- [ ] Environment variables stored in secrets manager
- [ ] Database credentials rotated regularly
- [ ] SSL/TLS enabled (HTTPS only)
- [ ] Rate limiting configured
- [ ] CORS origins restricted to your domains
- [ ] Database backups automated and tested
- [ ] Security headers configured (helmet.js)
- [ ] SQL injection protection (parameterized queries)
- [ ] Input validation and sanitization
- [ ] Prompt injection defense enabled
- [ ] Multi-tenant isolation validated
- [ ] Session secrets rotated
- [ ] API key rotation enabled
- [ ] Container scans passing (Trivy)
- [ ] Dependencies updated (npm audit)

---

## Troubleshooting

### Common Issues

**Database connection failed:**
```bash
# Check database is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres psql -U postgres -d leads_and_quotes -c "SELECT 1"

# Check logs
docker-compose logs postgres
```

**Anthropic API errors:**
```bash
# Verify API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":10,"messages":[{"role":"user","content":"ping"}]}'
```

**Health check failing:**
```bash
# Check all health endpoints
curl http://localhost:3000/api/v1/health
curl http://localhost:3000/api/v1/health/readiness
curl http://localhost:3000/api/v1/health/liveness

# Check logs
docker-compose logs app | grep -i error
```

---

## Rollback Procedure

### Docker Compose
```bash
# List images
docker images | grep leads-quotes

# Rollback to previous version
docker-compose down
docker tag leads-quotes:previous leads-quotes:latest
docker-compose up -d
```

### Kubernetes
```bash
# Rollback deployment
kubectl rollout undo deployment/leads-quotes-app

# Rollback to specific revision
kubectl rollout undo deployment/leads-quotes-app --to-revision=2

# Check rollout status
kubectl rollout status deployment/leads-quotes-app
```

---

## Maintenance Windows

**Recommended schedule:**
- **Database maintenance**: Sunday 2:00 AM - 4:00 AM
- **Application updates**: Sunday 12:00 AM - 2:00 AM
- **Security patches**: As needed (zero-downtime)

**Zero-downtime deployment:**
```bash
# Rolling update (k8s)
kubectl set image deployment/leads-quotes-app app=leads-quotes:v2

# Blue-green deployment (ECS)
aws ecs update-service \
  --cluster leads-quotes \
  --service leads-quotes-api \
  --task-definition leads-quotes:2 \
  --deployment-configuration maximumPercent=200,minimumHealthyPercent=100
```

---

## Support & Monitoring

- **Status Page**: Configure uptime monitoring (UptimeRobot, Pingdom)
- **Alerting**: Set up PagerDuty/OpsGenie for critical alerts
- **Logs**: Centralized logging (CloudWatch, Datadog, Splunk)
- **Metrics**: Application performance monitoring (New Relic, Datadog)

---

## Cost Optimization

**Estimated monthly costs:**
- **AWS ECS (2 tasks)**: ~$50-100/month
- **RDS PostgreSQL (db.t3.small)**: ~$30-50/month
- **Anthropic API**: $0.27 per customer/month
- **Total**: ~$80-150/month + API usage

**Cost-saving tips:**
- Use spot instances for non-critical environments
- Enable auto-scaling (scale down during off-hours)
- Use reserved instances for predictable workloads
- Implement caching (Redis) to reduce API calls
- Use CloudFront/CDN for static assets

---

For questions or issues, refer to the [GitHub repository](https://github.com/John-Dixon-IV/leads-and-quotes) or create an issue.
