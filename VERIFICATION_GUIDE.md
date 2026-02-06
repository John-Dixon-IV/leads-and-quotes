# 🧪 Verification Suite Guide

Complete guide for running production verification tests on Leads & Quotes SaaS.

---

## 📋 Overview

The verification suite includes **4 comprehensive tests** that validate:

1. **Docker Deployment** - Container build, health checks, and production readiness
2. **Ghost Buster Timezone Logic** - Office hours enforcement across timezones
3. **Math Sanity Engine** - Dimension extraction and area calculation correction
4. **Admin Stats & Revenue** - Platform-wide metrics and ROI calculations

---

## 🚀 Quick Start

### Run All Verifications (Recommended)

```bash
npm run verify:all
```

This runs all 4 verification scripts sequentially and generates a comprehensive report.

**Skip Docker verification** (if Docker Desktop is not running):

```bash
npm run verify:all:skip-docker
```

### Run Individual Verifications

```bash
# 1. Docker deployment verification
npm run verify:docker

# 2. Ghost Buster timezone logic
npm run verify:ghost-buster

# 3. Math sanity engine
npm run verify:math

# 4. Admin stats verification
npm run verify:admin
```

---

## 📦 Prerequisites

### Required

- **Node.js 20+** installed
- **PostgreSQL database** running and accessible
- **.env file** configured (copy from `config/env.production.example`)
- **ANTHROPIC_API_KEY** set in `.env`

### Optional (for Docker verification)

- **Docker Desktop** installed and running
- **docker-compose** available

---

## 🧪 Verification Details

### 1. Docker Deployment Verification

**Script:** `scripts/verify-docker.ts`
**Duration:** ~2-3 minutes
**Command:** `npm run verify:docker`

**What it tests:**
- ✅ Docker installation and daemon status
- ✅ Multi-stage Dockerfile build (builder + production)
- ✅ Container startup and orchestration
- ✅ Health check endpoint (`GET /api/v1/health`)
- ✅ Readiness probe (`GET /api/v1/health/readiness`)
- ✅ Liveness probe (`GET /api/v1/health/liveness`)
- ✅ Container logs for errors

**Success criteria:**
- Docker daemon running
- Image builds without errors
- All containers start successfully
- Health endpoints return 200 OK
- Database and Anthropic API connectivity verified

**Common issues:**
- **Docker daemon not running** - Start Docker Desktop
- **Port 3000 already in use** - Stop conflicting services
- **Database connection failed** - Check PostgreSQL is running and .env is configured

---

### 2. Ghost Buster Time-Warp Simulator

**Script:** `scripts/simulate-ghost-buster.ts`
**Duration:** ~30 seconds
**Command:** `npm run verify:ghost-buster`

**What it tests:**
- ✅ Timezone-aware office hours enforcement (8 AM - 8 PM local time)
- ✅ Ghost Buster respects customer timezone (`America/New_York`)
- ✅ Follow-up logic skips outside office hours (2 AM, 9 PM)
- ✅ Follow-up logic sends during office hours (8 AM - 8 PM)
- ✅ Incomplete lead detection (missing phone/email)

**Test scenarios:**
1. **2:00 AM EST** - Outside office hours → Should SKIP
2. **10:00 AM EST** - Within office hours → Should SEND
3. **9:00 PM EST** - After office hours → Should SKIP
4. **8:00 AM EST** - Start of office hours → Should SEND

**Success criteria:**
- All 4 scenarios pass
- Office hours logic correctly identifies local time
- No nudges sent outside 8 AM - 8 PM customer local time

**Example output:**
```
📍 Scenario: 2:00 AM EST - Outside Office Hours
   Customer Local Time: 2:00 (America/New_York)
   Expected Behavior: Skip (Outside Office Hours)
   Actual Behavior: Would Skip
   Logic Verification: ✅ PASS
```

---

### 3. Math Sanity Engine Stress Test

**Script:** `scripts/verify-math-sanity.ts`
**Duration:** ~45 seconds
**Command:** `npm run verify:math`

**What it tests:**
- ✅ Dimension extraction from natural language ("10x20 deck")
- ✅ Area calculation correction (10x20 ≠ 800 sqft, should be 200 sqft)
- ✅ AI acknowledges and corrects customer's math errors
- ✅ Quote uses correct area, not incorrect claimed area
- ✅ Handles correct math without unnecessary corrections

**Test scenarios:**
1. **Classic error:** "10x20 deck, about 800 square feet" → Correct to 200 sqft
2. **Another error:** "15x15 deck, around 300 square feet" → Correct to 225 sqft
3. **Correct math:** "12x10 deck, so 120 square feet" → No correction needed
4. **No area mentioned:** "20x25 foot deck" → Calculate 500 sqft

**Success criteria:**
- Correct area used in quote calculation
- Incorrect area NOT used in pricing
- AI response acknowledges correction politely
- No corrections when customer's math is right

**Example output:**
```
📐 Scenario: Classic Math Error (10x20 claimed as 800 sqft)
   Extracted Dimensions: 10x20
   Calculated Area: 200 sqft
   Claimed Area: 800 sqft
   Area Mismatch: YES ⚠️

💬 AI Quote Response:
   "Thanks for reaching out! I noticed the deck is 10ft x 20ft,
   which is actually 200 square feet (not 800). For a 200 sqft
   deck staining, the estimate would be $650-850..."

✅ Verification Checks:
   Correct Area Used (200 sqft): ✅ PASS
   Incorrect Area Not Used (800 sqft): ✅ PASS
   Acknowledged Correction: ✅ PASS
```

---

### 4. Admin Stats & Revenue Tracking

**Script:** `scripts/verify-admin-stats.ts`
**Duration:** ~20 seconds
**Command:** `npm run verify:admin`

**What it tests:**
- ✅ Platform-wide revenue aggregation across all tenants
- ✅ Ghost Buster success rate calculation
- ✅ AI cost vs. Revenue ROI calculation
- ✅ Lead qualification and quote rates
- ✅ Partner referral tracking
- ✅ QuickBooks export tracking
- ✅ Admin authentication (ADMIN_SECRET header)

**Test data created:**
- 2 test customers (Premium Decks LLC, Budget Repairs Inc)
- 7 test leads with various scenarios:
  - Qualified + Quoted + Complete + QBO Exported
  - Qualified + Quoted + Incomplete + Follow-up Sent
  - Qualified + Quoted + Complete + Follow-up Sent
  - Out-of-area + Referral Sent
  - Qualified + Quoted + Complete
  - Unqualified (no quote)
  - Qualified + Quoted + Incomplete + Follow-up Sent

**Metrics verified:**
- **Total Leads:** 7
- **Qualified Leads:** 6 (85.7% qualification rate)
- **Quoted Leads:** 5
- **Total Revenue:** $10,300 estimated
- **Actual Revenue:** $6,500 realized
- **Ghost Buster Sent:** 3 follow-ups
- **Ghost Buster Recovered:** 1 (33.3% success rate)
- **AI Cost:** ~$1.76
- **ROI:** ~580,000%+
- **Referrals:** 1
- **QBO Exports:** 2

**Success criteria:**
- All metric counts match expected values
- Revenue calculations are accurate
- Ghost Buster success rate formula correct
- ROI calculation includes AI costs
- Admin endpoint requires ADMIN_SECRET

**Example output:**
```
📊 Expected Metrics:
   Total Leads: 7
   Qualified Leads: 6
   Total Revenue: $10,300
   Actual Revenue: $6,500
   Ghost Buster Success Rate: 33.33%
   Total AI Cost: $1.76
   ROI: 584,659.09%

✅ Verification Results:
   Total Leads: ✅
   Qualified Leads: ✅
   Total Revenue: ✅
   Ghost Buster Success Rate: ✅
   ROI: ✅

🎉 All admin stats checks PASSED!
```

---

## 📊 Interpreting Results

### Success Report

When all tests pass, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║         VERIFICATION COMPLETE - Final Report              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

✅ 1. Docker Deployment Verification
   Status: PASSED
   Duration: 125.43s

✅ 2. Ghost Buster Time-Warp Simulator
   Status: PASSED
   Duration: 28.76s

✅ 3. Math Sanity Engine Stress Test
   Status: PASSED
   Duration: 42.18s

✅ 4. Admin Stats & Revenue Tracking
   Status: PASSED
   Duration: 18.92s

──────────────────────────────────────────────────────────
Total Tests: 4
Passed: 4 ✅
Failed: 0 ❌
Skipped: 0 ⏭️
Success Rate: 100.0%
══════════════════════════════════════════════════════════

🎉 ALL VERIFICATIONS PASSED! 🎉
   Your production deployment is ready to go live.
```

### Failure Report

When tests fail, you'll see detailed error messages:

```
❌ 2. Ghost Buster Time-Warp Simulator
   Status: FAILED
   Duration: 15.23s
   Error: Office hours check failed for 10 AM scenario

⚠️  SOME VERIFICATIONS FAILED
   Review the errors above and fix before deploying.
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```
❌ Database connection failed: ECONNREFUSED
```

**Fix:**
- Ensure PostgreSQL is running: `pg_ctl status`
- Check `.env` has correct `DATABASE_URL`
- Run migrations: `npm run migrate`

### Anthropic API Errors

```
❌ Health check failed: 401 Unauthorized
```

**Fix:**
- Verify `ANTHROPIC_API_KEY` in `.env` is valid
- Check API key has sufficient credits
- Test API key: `curl -H "x-api-key: YOUR_KEY" https://api.anthropic.com/v1/complete`

### Docker Not Running

```
❌ Docker daemon is not running
```

**Fix:**
- Start Docker Desktop
- Or skip Docker verification: `npm run verify:all:skip-docker`

### Server Already Running

```
❌ Port 3000 already in use
```

**Fix:**
- Stop existing server: `pkill -f "node.*index.js"`
- Or change port in `.env`: `PORT=3001`

### Math Sanity Test Fails

```
❌ FAIL: AI did not correct math error
```

**Fix:**
- Check AI prompt instructions in `ai_prompts.quote_instructions`
- Verify model is using correct pricing rules
- Review AI response for dimension extraction logic

### Admin Stats Mismatch

```
❌ (Expected: 7, Got: 12)
```

**Fix:**
- Database may have existing test data
- Clean database: Delete all rows where email LIKE '%test%'
- Or drop and recreate database

---

## 📝 Reports

Each verification run generates a timestamped report:

```
📄 Full report saved to: verification-report-2026-02-05T23-45-30.txt
```

**Report includes:**
- Test status (PASSED/FAILED/SKIPPED)
- Execution duration
- Full console output
- Error messages and stack traces
- Summary statistics

**View report:**

```bash
cat verification-report-2026-02-05T23-45-30.txt
```

---

## 🎯 Best Practices

### Before Deployment

1. **Run full suite:** `npm run verify:all`
2. **Review report:** Check all tests passed
3. **Fix failures:** Address any errors before deploying
4. **Re-run:** Verify fixes worked

### During Development

1. **Run relevant test:** e.g., `npm run verify:math` when changing quote logic
2. **Test incrementally:** Don't wait until the end
3. **Keep .env updated:** Ensure config matches production

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Verification Suite
  run: npm run verify:all:skip-docker
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    ADMIN_SECRET: ${{ secrets.ADMIN_SECRET }}
```

---

## 🚀 Next Steps

After all verifications pass:

1. **Deploy to production** - Follow [DEPLOYMENT.md](DEPLOYMENT.md)
2. **Monitor health checks** - Use `/api/v1/health` endpoint
3. **Review admin stats** - Check platform performance
4. **Onboard customers** - Start generating revenue!

---

## 📚 Additional Resources

- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [PRODUCTION_HARDENING_SUMMARY.md](PRODUCTION_HARDENING_SUMMARY.md) - Security features
- [PROJECT_COMPLETE.md](PROJECT_COMPLETE.md) - Complete feature list
- [README.md](README.md) - Project overview

---

**Last Updated:** February 5, 2026
**Version:** 1.0.0
