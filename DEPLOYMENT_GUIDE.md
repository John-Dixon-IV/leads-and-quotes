# 🚀 Deployment Guide: Going Live with leadsandquotes.com

**Status:** Ready for production deployment
**Domain:** leadsandquotes.com
**Last Updated:** February 6, 2026

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Option A: Quick Deploy (Recommended for MVP)](#option-a-quick-deploy-render--railway)
3. [Option B: Full Control (VPS + Docker)](#option-b-full-control-vps--docker)
4. [Domain & DNS Configuration](#domain--dns-configuration)
5. [SSL Certificate Setup](#ssl-certificate-setup)
6. [Environment Variables](#environment-variables)
7. [Database Migration](#database-migration)
8. [Post-Deployment Testing](#post-deployment-testing)
9. [Monitoring & Maintenance](#monitoring--maintenance)

---

## Pre-Deployment Checklist

### ✅ What's Already Done

- [x] Application code complete and tested
- [x] GitHub repository created and synced
- [x] API integration working (Anthropic Claude)
- [x] Database schema created
- [x] Widget tested locally
- [x] Marketing page complete
- [x] Domain purchased (leadsandquotes.com)

### 🔲 What We Need to Do

- [ ] Choose hosting provider
- [ ] Set up production database
- [ ] Configure domain DNS
- [ ] Deploy application
- [ ] Set up SSL certificate
- [ ] Test production deployment
- [ ] Go live!

---

## Option A: Quick Deploy (Render / Railway)

**Best for:** Getting live quickly, minimal DevOps, automatic scaling
**Cost:** ~$25-50/month
**Time:** 30-60 minutes

### Why This Option?
- ✅ Automatic SSL certificates
- ✅ Built-in PostgreSQL database
- ✅ Auto-deploy from GitHub
- ✅ Zero server management
- ✅ Free tier available for testing

### Step 1: Sign Up for Render

**Go to:** https://render.com

```bash
# Create account with GitHub
# Connect your repository: john-dixon-iv/leads-and-quotes
```

### Step 2: Create PostgreSQL Database

1. **Click:** "New" → "PostgreSQL"
2. **Configure:**
   - Name: `leads-quotes-db`
   - Database: `leads_and_quotes`
   - User: `postgres`
   - Region: `Oregon (US West)` or closest to your users
   - Plan: `Starter ($7/month)` or `Standard ($20/month)`

3. **Save Connection Details:**
   ```
   Internal Database URL: postgresql://postgres:xxxxx@dpg-xxxxx/leads_and_quotes
   External Database URL: postgresql://postgres:xxxxx@oregon-postgres.render.com/leads_and_quotes
   ```

### Step 3: Run Database Migrations

```bash
# On your local machine, connect to production database
export DATABASE_URL="postgresql://postgres:xxxxx@oregon-postgres.render.com/leads_and_quotes"

# Run migrations (this will create all tables)
psql $DATABASE_URL < src/db/migrations/001_initial_schema.sql

# Verify tables exist
psql $DATABASE_URL -c "\dt"
```

### Step 4: Create Web Service

1. **Click:** "New" → "Web Service"
2. **Connect Repository:** Select `leads-and-quotes`
3. **Configure:**
   - Name: `leads-quotes-app`
   - Region: Same as database
   - Branch: `main`
   - Runtime: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Plan: `Starter ($7/month)` or `Standard ($25/month)`

### Step 5: Set Environment Variables

In Render dashboard, add these environment variables:

```bash
# Database (copy from Render PostgreSQL service)
DATABASE_URL=postgresql://postgres:xxxxx@dpg-xxxxx/leads_and_quotes
DB_HOST=dpg-xxxxx-postgres.render.com
DB_PORT=5432
DB_NAME=leads_and_quotes
DB_USER=postgres
DB_PASSWORD=xxxxx

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx-YOUR-KEY-HERE

# Server
PORT=3000
NODE_ENV=production

# Admin
ADMIN_SECRET=CHANGE_THIS_TO_STRONG_RANDOM_STRING

# Workers
ENABLE_FOLLOWUP_WORKER=true
ENABLE_DIGEST_WORKER=true

# Widget (update after deployment)
WIDGET_URL=https://leads-quotes-app.onrender.com/widget.js
API_BASE_URL=https://leads-quotes-app.onrender.com
```

**Generate Admin Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 6: Deploy

1. Click **"Create Web Service"**
2. Wait 5-10 minutes for build
3. Once deployed, you'll get a URL: `https://leads-quotes-app.onrender.com`
4. Test: `https://leads-quotes-app.onrender.com/api/v1/health/liveness`

### Step 7: Add Custom Domain

1. In Render dashboard, go to your web service
2. Click **"Settings"** → **"Custom Domain"**
3. Add: `leadsandquotes.com` and `www.leadsandquotes.com`
4. Render will provide DNS records (continue to DNS Configuration section)

**Total Time:** 30-60 minutes
**Total Cost:** $14-45/month

---

## Option B: Full Control (VPS + Docker)

**Best for:** Full control, custom scaling, cost optimization at scale
**Cost:** ~$12-40/month
**Time:** 2-4 hours

### Why This Option?
- ✅ Complete control over infrastructure
- ✅ Better performance (dedicated resources)
- ✅ Lower cost at scale
- ✅ Docker containerization
- ✅ Can add Redis, monitoring, etc.

### Step 1: Provision VPS Server

**Recommended Providers:**
- **DigitalOcean:** Simple, reliable ($12-24/month)
- **Linode:** Great performance ($12-24/month)
- **Hetzner:** Cheapest ($5-20/month)
- **AWS Lightsail:** Integrated with AWS ($12-40/month)

**Server Specs (Minimum):**
```
CPU: 2 vCPU
RAM: 2 GB
Storage: 50 GB SSD
OS: Ubuntu 22.04 LTS
```

### Step 2: Initial Server Setup

```bash
# SSH into your server
ssh root@YOUR_SERVER_IP

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create non-root user
adduser deploy
usermod -aG sudo deploy
usermod -aG docker deploy

# Set up firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Switch to deploy user
su - deploy
```

### Step 3: Clone Repository

```bash
# Generate SSH key for GitHub
ssh-keygen -t ed25519 -C "your_email@example.com"
cat ~/.ssh/id_ed25519.pub
# Add this key to GitHub: Settings → SSH Keys

# Clone repository
git clone git@github.com:john-dixon-iv/leads-and-quotes.git
cd leads-and-quotes
```

### Step 4: Configure Environment

```bash
# Create production .env file
cp .env .env.production
nano .env.production
```

**Production .env:**
```bash
# Database (will be docker container)
DATABASE_URL=postgresql://postgres:STRONG_PASSWORD_HERE@postgres:5432/leads_and_quotes
DB_HOST=postgres
DB_PORT=5432
DB_NAME=leads_and_quotes
DB_USER=postgres
DB_PASSWORD=STRONG_PASSWORD_HERE

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx-YOUR-KEY-HERE

# Server
PORT=3000
NODE_ENV=production

# Admin
ADMIN_SECRET=GENERATE_STRONG_RANDOM_STRING

# Workers
ENABLE_FOLLOWUP_WORKER=true
ENABLE_DIGEST_WORKER=true

# Widget
WIDGET_URL=https://leadsandquotes.com/widget.js
API_BASE_URL=https://leadsandquotes.com

# Twilio (optional)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_FROM=

# SendGrid (optional)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
```

### Step 5: Update docker-compose.yml for Production

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: leads-quotes-db-prod
    restart: always
    env_file: .env.production
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./src/db/migrations:/docker-entrypoint-initdb.d:ro
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    container_name: leads-quotes-app-prod
    restart: always
    depends_on:
      postgres:
        condition: service_healthy
    env_file: .env.production
    ports:
      - "3000:3000"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/v1/health/liveness"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  nginx:
    image: nginx:alpine
    container_name: leads-quotes-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot-webroot:/var/www/certbot:ro
    networks:
      - app-network
    depends_on:
      - app

  certbot:
    image: certbot/certbot
    container_name: leads-quotes-certbot
    volumes:
      - ./ssl:/etc/letsencrypt
      - certbot-webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

volumes:
  postgres_data:
  certbot-webroot:

networks:
  app-network:
    driver: bridge
```

### Step 6: Create Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name leadsandquotes.com www.leadsandquotes.com;

        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }

        location / {
            return 301 https://$host$request_uri;
        }
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name leadsandquotes.com www.leadsandquotes.com;

        ssl_certificate /etc/letsencrypt/live/leadsandquotes.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/leadsandquotes.com/privkey.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;

        client_max_body_size 10M;

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Step 7: Set Up SSL Certificate

```bash
# First, start nginx in HTTP-only mode to get certificate
# Comment out the HTTPS server block in nginx.conf temporarily

# Start containers
docker-compose -f docker-compose.prod.yml up -d

# Get SSL certificate
docker run -it --rm \
  -v $(pwd)/ssl:/etc/letsencrypt \
  -v $(pwd)/certbot-webroot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d leadsandquotes.com \
  -d www.leadsandquotes.com

# Uncomment HTTPS server block in nginx.conf

# Restart nginx
docker-compose -f docker-compose.prod.yml restart nginx
```

### Step 8: Deploy Application

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d --build

# Check logs
docker-compose -f docker-compose.prod.yml logs -f app

# Verify health
curl http://localhost:3000/api/v1/health/liveness
```

**Total Time:** 2-4 hours
**Total Cost:** $12-40/month

---

## Domain & DNS Configuration

### For Render (Option A)

**In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):**

1. Add **A Record:**
   ```
   Type: A
   Name: @
   Value: [Render provides this IP]
   TTL: 3600
   ```

2. Add **CNAME Record:**
   ```
   Type: CNAME
   Name: www
   Value: leads-quotes-app.onrender.com
   TTL: 3600
   ```

### For VPS (Option B)

**In your domain registrar:**

1. Add **A Record:**
   ```
   Type: A
   Name: @
   Value: [Your VPS IP Address]
   TTL: 3600
   ```

2. Add **A Record (www):**
   ```
   Type: A
   Name: www
   Value: [Your VPS IP Address]
   TTL: 3600
   ```

### DNS Propagation

- **Time:** 5 minutes to 48 hours (usually 30 minutes)
- **Check:** https://dnschecker.org
- **Test:** `nslookup leadsandquotes.com`

---

## SSL Certificate Setup

### Option A (Render)
✅ **Automatic** - Render provisions Let's Encrypt certificates automatically

### Option B (VPS)
```bash
# Already covered in Step 7 above
# Certificate auto-renews every 12 hours via certbot container
```

---

## Environment Variables

### Critical Production Changes

**Update these in production .env:**

```bash
# ⚠️ CHANGE THESE FROM DEVELOPMENT VALUES
ADMIN_SECRET=[Generate 64-character random string]
DB_PASSWORD=[Generate strong password, not "changeme"]
NODE_ENV=production

# ✅ UPDATE THESE WITH PRODUCTION URLs
WIDGET_URL=https://leadsandquotes.com/widget.js
API_BASE_URL=https://leadsandquotes.com

# 🔐 NEVER COMMIT .env.production TO GIT
```

**Generate Secure Secrets:**
```bash
# Admin secret
openssl rand -hex 32

# Database password
openssl rand -base64 32
```

---

## Database Migration

### Option A: Using Render Database

```bash
# Connect to production database
psql "postgresql://postgres:xxxxx@oregon-postgres.render.com/leads_and_quotes"

# Run migration
\i src/db/migrations/001_initial_schema.sql

# Verify tables
\dt

# Quit
\q
```

### Option B: Docker Database

```bash
# Migrations run automatically via docker-entrypoint-initdb.d
# They execute when container first starts

# To manually run:
docker exec -i leads-quotes-db-prod psql -U postgres -d leads_and_quotes < src/db/migrations/001_initial_schema.sql
```

### Seed Initial Customer Data

```sql
-- Create your first customer account
INSERT INTO customers (
  customer_id,
  api_key,
  company_name,
  email,
  phone,
  is_active,
  business_info,
  ai_prompts
) VALUES (
  'demo-customer-001',
  'demo-key-for-saas-sales',
  'Leads & Quotes Demo',
  'demo@leadsandquotes.com',
  '555-0100',
  true,
  '{
    "services": ["Lead Capture", "AI Quotes", "Ghost Buster"],
    "service_area": "United States",
    "timezone": "America/New_York",
    "office_hours": {"start": "09:00", "end": "17:00"}
  }',
  '{
    "system_prompt": "You are a helpful sales assistant for Leads & Quotes, a SaaS platform that helps contractors capture and qualify leads.",
    "widget_greeting": "Hi! I can help you learn about our lead capture and quoting platform. What questions do you have?"
  }'
);
```

---

## Post-Deployment Testing

### 1. Health Check

```bash
# Test liveness endpoint
curl https://leadsandquotes.com/api/v1/health/liveness

# Expected: {"status":"alive"}

# Test full health check
curl https://leadsandquotes.com/api/v1/health

# Expected: Full health report with database status
```

### 2. Landing Page

```bash
# Visit in browser
open https://leadsandquotes.com

# Should load marketing page with:
# ✓ Hero section
# ✓ ROI calculator
# ✓ Pricing section
# ✓ Widget in bottom-right corner
```

### 3. Widget Functionality

```javascript
// Open browser console on landing page
// Test sending a message

// 1. Open widget (click bottom-right)
// 2. Type: "How much does this cost?"
// 3. Verify AI responds with pricing info
// 4. Check for confidence score in response
```

### 4. Admin Dashboard

```bash
# Visit admin stats
open https://leadsandquotes.com/admin

# Should show:
# ✓ Total leads
# ✓ Qualified leads
# ✓ Hot leads
# ✓ Statistics
```

### 5. API Endpoint Testing

```bash
# Test widget endpoint
curl -X POST https://leadsandquotes.com/api/v1/widget/message \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-for-saas-sales" \
  -d '{
    "message": "I need a quote for roofing",
    "session_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# Should return AI classification with confidence score
```

---

## Monitoring & Maintenance

### Set Up Monitoring

**1. Uptime Monitoring (Free)**
- **UptimeRobot:** https://uptimerobot.com
- **Pingdom:** https://www.pingdom.com
- Monitor: `https://leadsandquotes.com/api/v1/health/liveness`
- Alert via email/SMS if down

**2. Error Tracking**
- **Sentry:** https://sentry.io (free tier)
```bash
npm install @sentry/node
# Add to src/index.ts
```

**3. Log Aggregation**
```bash
# For Render: Built-in logs viewer
# For VPS: Use Docker logs
docker-compose -f docker-compose.prod.yml logs -f --tail=100
```

### Regular Maintenance Tasks

**Weekly:**
- [ ] Check error logs
- [ ] Review lead conversion rates
- [ ] Monitor API usage/costs

**Monthly:**
- [ ] Review security updates
- [ ] Backup database
- [ ] Update dependencies

**Backups:**
```bash
# Automated database backup (add to cron)
0 2 * * * docker exec leads-quotes-db-prod pg_dump -U postgres leads_and_quotes | gzip > /backup/db_$(date +\%Y\%m\%d).sql.gz

# Keep last 30 days
find /backup -name "db_*.sql.gz" -mtime +30 -delete
```

---

## Deployment Checklist

### Pre-Launch

- [ ] Domain purchased and accessible
- [ ] SSL certificate installed and valid
- [ ] All environment variables set correctly
- [ ] Database migrated and seeded
- [ ] Health checks passing
- [ ] Widget responding with AI
- [ ] Landing page loading correctly
- [ ] Admin dashboard accessible

### Launch Day

- [ ] DNS records updated
- [ ] SSL certificate verified (https://)
- [ ] Full smoke test of all features
- [ ] Monitoring alerts configured
- [ ] Backup system tested
- [ ] API keys secured (not in GitHub)

### Post-Launch

- [ ] Monitor error rates (first 24 hours)
- [ ] Check widget performance
- [ ] Review first real customer interactions
- [ ] Update documentation with any changes
- [ ] Celebrate! 🎉

---

## Recommended Approach

**For MVP (Get Live Fast):**
```
✅ Option A: Render
- Fastest deployment (30-60 minutes)
- Automatic SSL
- Built-in database
- Auto-scaling
```

**For Long-Term (Best Control):**
```
✅ Option B: VPS + Docker
- Full control
- Better performance
- Lower cost at scale
- More configuration required
```

---

## Cost Breakdown

### Option A: Render
| Service | Cost |
|---------|------|
| PostgreSQL (Starter) | $7/month |
| Web Service (Starter) | $7/month |
| **Total** | **$14/month** |

**Scale Up:**
- Standard PostgreSQL: $20/month
- Standard Web Service: $25/month
- **Total:** $45/month

### Option B: VPS
| Service | Cost |
|---------|------|
| DigitalOcean Droplet (2GB) | $12/month |
| Domain (already purchased) | - |
| **Total** | **$12/month** |

**Scale Up:**
- 4GB RAM: $24/month
- 8GB RAM: $48/month
- Add Redis: +$15/month

---

## Next Steps

1. **Choose Your Option** (A or B)
2. **Follow Step-by-Step Guide Above**
3. **Configure DNS** (5-30 minutes)
4. **Deploy Application** (30 minutes - 2 hours)
5. **Test Everything** (30 minutes)
6. **Go Live!** 🚀

---

## Support & Troubleshooting

### Common Issues

**"Site not accessible"**
- Check DNS propagation: https://dnschecker.org
- Wait up to 48 hours for full propagation
- Verify A/CNAME records are correct

**"SSL certificate error"**
- Verify certificate is installed: `curl -vI https://leadsandquotes.com`
- Check certificate expiry: `openssl s_client -connect leadsandquotes.com:443 | openssl x509 -noout -dates`
- Renew if expired: `certbot renew`

**"Widget not responding"**
- Check browser console for errors
- Verify API_BASE_URL in .env
- Test API endpoint directly with curl
- Check CORS settings

**"Database connection failed"**
- Verify DATABASE_URL is correct
- Check database is running: `docker ps` (VPS) or Render dashboard
- Test connection: `psql $DATABASE_URL -c "SELECT 1;"`

### Get Help

- **GitHub Issues:** https://github.com/john-dixon-iv/leads-and-quotes/issues
- **Documentation:** This file and other .md files in repo
- **Logs:** Check application logs for errors

---

**Ready to deploy? Start with Option A (Render) for the fastest path to production!**

**Estimated Total Time to Live:** 1-2 hours (Option A) or 3-5 hours (Option B)
