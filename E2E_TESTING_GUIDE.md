# End-to-End Testing Guide

## Overview

The E2E test suite ([tests/e2e_scenarios.test.ts](tests/e2e_scenarios.test.ts)) validates the complete lead capture and recovery system by simulating three critical customer journeys through your SaaS platform.

---

## Test Scenarios

### 1. Golden Path 🎯

**Objective**: Validate complete conversation flow with quote generation

**Scenario**:
- Visitor asks for deck staining
- Provides name, phone, and address in 3 turns
- System generates quote with 15% buffer

**Success Metrics**:
- ✅ `next_action` changes to `generate_quote`
- ✅ Quote is generated with `estimated_range`
- ✅ Quote includes breakdown with buffer
- ✅ Conversation marked as completed
- ✅ Confidence score ≥ 0.6

**Expected Flow**:
```
Turn 1: "I need deck staining"
  → AI asks for name
  → Classification: deck_repair
  → next_action: ask_info

Turn 2: "My name is Sarah Johnson"
  → AI asks for phone
  → Confidence increases
  → next_action: ask_info

Turn 3: "My phone is 512-555-1234"
  → AI asks for address
  → Confidence increases
  → next_action: ask_info

Turn 4: "I'm at 123 Main St, Austin"
  → AI generates quote
  → next_action: generate_quote
  → Quote: $X-$Y (with 15% buffer)
  → conversation_ended: true
```

---

### 2. Ghost Buster Recovery 👻

**Objective**: Validate automated follow-up system for abandoned conversations

**Scenario**:
- Visitor asks for fence repair
- Provides name then abandons
- System ages lead to 20 minutes old
- Ghost Buster worker triggers
- Follow-up nudge generated

**Success Metrics**:
- ✅ Follow-up message generated
- ✅ Message is ≤ 15 words
- ✅ `follow_up_sent` flag set to true
- ✅ Lead not marked as stopped

**Expected Flow**:
```
Turn 1: "I need fence repair"
  → AI responds
  → Lead created

Turn 2: "My name is Mike Davis"
  → AI asks for more info
  → Visitor abandons...

[System ages lead to 20 minutes old]

Ghost Buster Worker:
  → Detects incomplete lead
  → Generates 15-word nudge
  → Sends follow-up
  → Flags follow_up_sent = true
  → Logs to followups table
```

**Example Nudge**:
> "Hi Mike! Still interested in fence repair? Happy to help. - Joe's Contracting"

---

### 3. Red Alert Path 🚨

**Objective**: Validate emergency detection and hot lead alerts

**Scenario**:
- Visitor reports: "My basement is currently flooding and the power is sparking"
- System detects high urgency
- Provides contact information
- Hot lead alert triggered

**Success Metrics**:
- ✅ `urgency_score` > 0.9
- ✅ `next_action` is `emergency_handoff` or quote generated
- ✅ High urgency detected (≥ 0.8)
- ✅ Notification logged to `notifications` table

**Expected Flow**:
```
Turn 1: "My basement is currently flooding and the power is sparking."
  → AI detects EMERGENCY
  → urgency_score: 0.95+
  → Category: Emergency
  → Asks for contact info immediately

Turn 2: "My name is Lisa Anderson, phone 512-555-9999"
  → AI urgently requests address
  → Maintains high urgency

Turn 3: "456 Oak St, Austin TX"
  → System qualifies lead
  → Generates quote if possible
  → Triggers hot lead alert (urgency ≥ 0.8)
  → Logs to notifications table
  → SMS + Email sent (in production)
```

**Alert Format**:
```
🚨 EMERGENCY Lead: Water Damage
Lisa - $2,500 - Call now!
```

---

## Running the Tests

### Prerequisites

1. **Database**: PostgreSQL running with migrations applied
2. **Seed Data**: Test customer created
3. **Environment**: `.env` configured with `ANTHROPIC_API_KEY`

```bash
# Setup (if not done)
npm run migrate
npm run db:seed

# Run E2E tests
npm run test:e2e
```

---

## Expected Output

### Successful Test Run

```
═══════════════════════════════════════════════════════════
🧪 E2E Test Suite: Lead Capture & Recovery System
═══════════════════════════════════════════════════════════

[Setup] Test customer: Joe's Contracting & Home Services
[Setup] Customer ID: abc123...

───────────────────────────────────────────────────────────
📋 Test 1: Golden Path (Complete Conversation)
───────────────────────────────────────────────────────────

[Turn 1] Visitor: "I need deck staining"
[Turn 1] AI: "I'd be happy to help with your deck staining project..."
[Turn 1] Classification: deck_repair
[Turn 1] Confidence: 0.85
[Turn 1] Next Action: ask_info

[Turn 2] Visitor: "My name is Sarah Johnson"
[Turn 2] AI: "Thanks Sarah! To provide an accurate estimate..."
[Turn 2] Confidence: 0.88
[Turn 2] Next Action: ask_info

[Turn 3] Visitor: "My phone is 512-555-1234"
[Turn 3] AI: "Perfect! One more thing..."
[Turn 3] Confidence: 0.90
[Turn 3] Next Action: ask_info

[Turn 4] Visitor: "I'm at 123 Main St, Austin"
[Turn 4] AI: "Based on your deck staining project..."
[Turn 4] Quote: { estimated_range: "$800-$1,000", breakdown: {...} }
[Turn 4] Conversation Ended: true

✅ Golden Path Results:
   Success: ✓
   Quote Generated: ✓
   Estimated Range: $800-$1,000
   Confidence: 0.92
   Conversation Completed: ✓

───────────────────────────────────────────────────────────
👻 Test 2: Ghost Buster Recovery (Abandoned Conversation)
───────────────────────────────────────────────────────────

[Turn 1] Visitor: "I need fence repair"
[Turn 1] AI: "I can help with that fence repair..."
[Turn 1] Lead ID: xyz789...

[Turn 2] Visitor: "My name is Mike Davis"
[Turn 2] AI: "Thanks Mike! What's the best phone..."
[Turn 2] Visitor abandons conversation...

[Action] Simulating 20 minutes passing...
[State] Before Follow-up:
   Complete: false
   Follow-up Sent: false
   Stopped: false

[Action] Triggering Ghost Buster worker...
[State] After Follow-up:
   Follow-up Sent: true
   Stopped: false

[Follow-up] Message: "Hi Mike! Still interested in fence repair? Happy to help."
[Follow-up] Word Count: 10
[Follow-up] Sent At: 2026-02-05 23:15:00

✅ Ghost Buster Results:
   Success: ✓
   Follow-up Generated: ✓
   Word Count ≤ 15: ✓ (10 words)
   Follow-up Sent Flag: ✓
   Message: "Hi Mike! Still interested in fence repair? Happy to help."

───────────────────────────────────────────────────────────
🚨 Test 3: Red Alert Path (Emergency Situation)
───────────────────────────────────────────────────────────

[Turn 1] Visitor: "My basement is currently flooding and the power is sparking."
[Turn 1] AI: "This sounds like an emergency situation..."
[Turn 1] Classification: { urgency_score: 0.98, category: "Emergency" }
[Turn 1] Lead ID: emergency123...

[Turn 2] Visitor: "My name is Lisa Anderson, phone 512-555-9999"
[Turn 2] AI: "Lisa, I need your address immediately..."
[Turn 2] Classification: { urgency_score: 0.97 }

[Turn 3] Visitor: "456 Oak St, Austin TX"
[Turn 3] AI: "I'm treating this as an emergency..."
[Turn 3] Final Classification: { urgency_score: 0.97, next_action: "emergency_handoff" }

[Alert] Notification logged:
   Type: hot_lead_alert
   Channel: sms
   Content: "🚨 EMERGENCY Lead: Water Damage - Lisa - $2,500 - Call now!"
   Status: sent

✅ Red Alert Results:
   Success: ✓
   Urgency Score: 0.97 (> 0.9) ✓
   High Urgency Detected: ✓
   Next Action: emergency_handoff
   Alert Logged: ✓

═══════════════════════════════════════════════════════════
📊 Test Suite Summary
═══════════════════════════════════════════════════════════

1. Golden Path: ✅ PASS
2. Ghost Buster Recovery: ✅ PASS
3. Red Alert Path: ✅ PASS

───────────────────────────────────────────────────────────
Total Tests: 3
Passed: 3 ✓
Failed: 0
Success Rate: 100.0%
═══════════════════════════════════════════════════════════

🎉 All tests passed! System is working as expected.
```

---

## Test Validation

### Golden Path Validations

- [x] Service type correctly identified (deck_repair/deck_installation)
- [x] `next_action` progresses through `ask_info` → `generate_quote`
- [x] Confidence score increases with each turn
- [x] Quote includes `estimated_range` (e.g., "$800-$1,000")
- [x] Quote includes `breakdown` with buffer calculation
- [x] Conversation marked as ended
- [x] Final confidence ≥ 0.6

### Ghost Buster Validations

- [x] Lead created and conversation started
- [x] Lead properly aged to 20 minutes
- [x] Follow-up worker detects incomplete lead
- [x] Nudge message generated
- [x] Nudge is ≤ 15 words (strict limit)
- [x] `follow_up_sent` flag set to `true`
- [x] Lead not marked as `stopped`
- [x] Nudge logged to `followups` table

### Red Alert Validations

- [x] Emergency keywords detected ("flooding", "sparking", "emergency")
- [x] `urgency_score` calculated > 0.9
- [x] `category` set to "Emergency" or similar
- [x] High urgency threshold met (≥ 0.8)
- [x] `next_action` is `emergency_handoff` or quote generated
- [x] Hot lead alert triggered (if urgency ≥ 0.8)
- [x] Notification logged to `notifications` table
- [x] Alert contains urgency emoji (🚨 EMERGENCY)

---

## Troubleshooting

### Test Fails: "Test customer not found"

**Solution**:
```bash
npm run db:seed
```

Creates test customer with all required fields.

---

### Test Fails: Claude API errors

**Check**:
1. `ANTHROPIC_API_KEY` in `.env`
2. API key is valid and has credits
3. Network connectivity

**Solution**:
```bash
# Verify API key
echo $ANTHROPIC_API_KEY

# Test API directly
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":100,"messages":[{"role":"user","content":"test"}]}'
```

---

### Test Fails: Database connection

**Check**:
1. PostgreSQL is running
2. `DATABASE_URL` in `.env` is correct
3. Migrations have been applied

**Solution**:
```bash
# Check PostgreSQL status
pg_isready

# Re-run migrations
npm run migrate
```

---

### Ghost Buster Test: No follow-up generated

**Possible Causes**:
1. Lead is within office hours check (7 AM - 9 PM)
2. Lead already has `follow_up_sent = true`
3. Lead is marked as `stopped = true`

**Debug**:
```sql
-- Check lead state
SELECT lead_id, is_complete, follow_up_sent, stopped, updated_at
FROM leads
WHERE session_id LIKE 'test-ghost-%'
ORDER BY created_at DESC
LIMIT 1;

-- Check if follow-up was logged
SELECT * FROM followups
WHERE lead_id = 'YOUR_LEAD_ID'
ORDER BY created_at DESC;
```

---

### Red Alert Test: Urgency score too low

**Possible Causes**:
1. Claude Haiku didn't detect emergency keywords
2. Message not phrased as urgent enough
3. Classification confidence below threshold

**Expected Keywords for High Urgency**:
- "emergency"
- "urgent"
- "immediately"
- "flooding"
- "fire"
- "sparking"
- "leaking badly"
- "today"
- "right now"

---

## Interpreting Results

### Success Rate Target

**Production Standard**: ≥ 95% success rate

### Individual Test Importance

| Test | Critical? | Impact if Failed |
|------|-----------|------------------|
| Golden Path | 🔴 Critical | Core lead capture broken |
| Ghost Buster | 🟡 Important | Missing 3x revenue opportunity |
| Red Alert | 🟡 Important | Missing urgent leads |

### What to Do if Tests Fail

1. **Golden Path Fails**:
   - Check Claude API integration
   - Verify prompt logic in [claude.service.ts](src/services/claude.service.ts)
   - Validate confidence threshold (0.6)

2. **Ghost Buster Fails**:
   - Check followup worker is running
   - Verify cron schedule (every 5 minutes)
   - Test office hours logic
   - Validate 15-word limit

3. **Red Alert Fails**:
   - Review urgency detection prompt
   - Check notification service integration
   - Verify urgency threshold (0.8)
   - Test alert logging

---

## Adding New Test Scenarios

### Template for New Test

```typescript
async testMyNewScenario(): Promise<void> {
  console.log('───────────────────────────────────────────────────────────');
  console.log('🎯 Test X: My New Scenario');
  console.log('───────────────────────────────────────────────────────────\n');

  const result: TestResult = {
    scenario: 'My New Scenario',
    success: false,
    metrics: {},
    errors: [],
  };

  try {
    const sessionId = `test-mynew-${Date.now()}`;

    // Test logic here
    // ...

    // Validate success
    result.success = true; // based on your criteria

  } catch (error) {
    result.success = false;
    result.errors.push(`Test failed: ${error}`);
  }

  this.results.push(result);
}
```

---

## Cost Analysis

### Per Test Run

| Test | Claude Calls | Est. Cost |
|------|--------------|-----------|
| Golden Path | 4 turns (Haiku) + 1 quote (Sonnet) | ~$0.006 |
| Ghost Buster | 2 turns (Haiku) + 1 nudge (Haiku) | ~$0.003 |
| Red Alert | 3 turns (Haiku) + 1 quote (Sonnet) + 1 alert (Haiku) | ~$0.008 |
| **Total** | | **~$0.017** |

Running the E2E test suite costs approximately **$0.02 per run**.

---

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run migrations
        run: npm run migrate
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Seed database
        run: npm run db:seed
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## Summary

The E2E test suite provides **comprehensive validation** of your lead capture and recovery system:

✅ **Golden Path**: Validates core conversation flow and quote generation
✅ **Ghost Buster**: Validates automated follow-up system
✅ **Red Alert**: Validates emergency detection and hot lead alerts

**Run regularly** to ensure all systems are functioning correctly!

**Cost**: ~$0.02 per test run
**Duration**: ~30-60 seconds
**Coverage**: All critical paths through the system

---

**Pro Tip**: Run `npm run test:e2e` before deploying to production to catch any regressions!
