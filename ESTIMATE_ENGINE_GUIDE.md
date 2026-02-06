# Estimate & Quote Engine Guide

## Overview

The Estimate Engine uses **Claude 3.5 Sonnet** to generate conservative, non-binding price estimates based on customer-defined pricing rules and lead data.

---

## Why Sonnet? (Not Haiku)

| Capability | Haiku | Sonnet |
|------------|-------|--------|
| **Math Accuracy** | ❌ Can hallucinate | ✅ Accurate arithmetic |
| **Reasoning** | Basic | ✅ Complex logic (15% buffer, rounding) |
| **Cost** | $0.25/MTok | $3/MTok (worth it for accuracy) |
| **Use Case** | Classification | ✅ Quote generation |

**Bottom Line**: Sonnet's superior reasoning prevents pricing errors that could cost the business thousands.

---

## Architecture

```
Lead Qualification (Haiku)
  ↓
  next_action: 'generate_quote'
  ↓
Estimate Engine (Sonnet)
  ↓
  Returns: { quote: {...}, error: null }
  ↓
Store quote in database
  ↓
Send quote to customer
```

---

## Arithmetic Rules

The engine follows these steps:

1. **IDENTIFY**: Match `service_type` to `pricing_rules`
2. **CALCULATE BASE**: Multiply unit value by min/max rates
3. **ADD FEES**: Add base_fee and service_call_fee to both ends
4. **BUFFER**: Add 15% complexity buffer to high-end
5. **ROUNDING**: Round to nearest $5 or $10 for professionalism

### Example Calculation

**Input:**
```json
{
  "service": "deck_staining",
  "dimensions": { "value": 200, "unit": "sq_ft" },
  "pricing_rule": { "min": 3.00, "max": 5.00, "base_fee": 100 }
}
```

**Calculation:**
```
Low estimate:  (200 × $3.00) + $100 = $700
High estimate: (200 × $5.00) + $100 = $1,100
Apply 15% buffer: $1,100 × 1.15 = $1,265
Round: $700 - $1,265
```

**Output:**
```json
{
  "estimated_range": "$700 - $1,265",
  "breakdown": {
    "base_fee": 100,
    "estimated_labor_low": 600,
    "estimated_labor_high": 1100,
    "buffer_applied": "15%"
  }
}
```

---

## Pricing Rules Format

Pricing rules are stored in the `customers.pricing_rules` JSONB field.

### Example Pricing Rules

```json
{
  "deck_staining": {
    "unit": "sq_ft",
    "min": 3.00,
    "max": 5.00,
    "base_fee": 100
  },
  "fence_repair": {
    "unit": "linear_ft",
    "min": 15.00,
    "max": 25.00,
    "base_fee": 75
  },
  "roofing": {
    "unit": "sq_ft",
    "min": 5.00,
    "max": 8.00,
    "base_fee": 500,
    "service_call_fee": 150
  },
  "gutter_cleaning": {
    "unit": "flat_rate",
    "min": 150,
    "max": 250
  }
}
```

### Supported Units

- `sq_ft` - Square feet (decks, roofing, flooring)
- `linear_ft` - Linear feet (fencing, trim)
- `flat_rate` - Fixed price range (gutter cleaning, inspections)
- `hourly` - Hourly rate (custom work)

---

## Input Schema

```typescript
interface EstimateRequest {
  business_context: {
    pricing_rules: {
      [service_type: string]: {
        unit: string;
        min: number;
        max: number;
        base_fee?: number;
        service_call_fee?: number;
      };
    };
  };
  lead_data: {
    service: string;
    dimensions?: {
      value: number;
      unit: string;
    };
    notes?: string;
  };
}
```

---

## Output Schema

```typescript
interface EstimateResponse {
  quote: {
    estimated_range: string;        // "$700 - $1,265"
    is_calculated: boolean;          // true if dimensions provided
    breakdown: {
      base_fee: number;              // 100
      estimated_labor_low: number;   // 600
      estimated_labor_high: number;  // 1100
      buffer_applied: string;        // "15%"
    };
    assistant_reply: string;         // Conversational response
    disclaimer: string;              // Legal disclaimer
  } | null;
  error: string | null;
}
```

---

## Usage Example

```typescript
import estimateService from './services/estimate.service';

const estimate = await estimateService.generateEstimate({
  business_context: {
    pricing_rules: customer.pricing_rules,
  },
  lead_data: {
    service: 'deck_staining',
    dimensions: {
      value: 200,
      unit: 'sq_ft',
    },
    notes: 'Wood is weathered, needs cleaning first',
  },
});

if (estimate.error) {
  // Handle error (missing dimensions, invalid service, etc.)
  console.error(estimate.error);
} else {
  // Store quote in database
  await db.query(
    `UPDATE leads SET quote = $1 WHERE lead_id = $2`,
    [JSON.stringify(estimate.quote), leadId]
  );

  // Send to customer
  return estimate.quote.assistant_reply;
}
```

---

## Error Handling

### Service Not Found

**Input:**
```json
{
  "service": "pool_installation",
  "pricing_rules": { "deck_staining": {...} }
}
```

**Output:**
```json
{
  "quote": null,
  "error": "We don't have pricing information for that service. Please contact us directly."
}
```

### Missing Dimensions

**Input:**
```json
{
  "service": "fence_repair",
  "dimensions": null
}
```

**Output:**
```json
{
  "quote": null,
  "error": "I need more details about the project size to provide an estimate. Can you share the dimensions?"
}
```

### Invalid Dimensions

**Input:**
```json
{
  "service": "deck_staining",
  "dimensions": { "value": 0, "unit": "sq_ft" }
}
```

**Output:**
```json
{
  "quote": null,
  "error": "The dimensions provided don't seem right. Can you double-check the project size?"
}
```

---

## Assistant Reply Format

The engine generates conversational responses that:

1. **Start with context**: "Based on [dimensions], my rough estimate for [service] is between [range]."
2. **Explain what's included**: Base fee, materials, labor
3. **End with CTA**: "Would you like to schedule an on-site visit to finalize this?"

### Example Reply

```
"Based on a 200 sq ft deck, my rough estimate for staining is between $700 and $1,265.
This includes our $100 base service fee and premium materials. Would you like to schedule
an on-site visit to finalize this?"
```

---

## Disclaimers

Every quote includes a mandatory disclaimer:

```
"This estimate is non-binding and subject to change upon physical inspection."
```

This protects the contractor from:
- Hidden issues discovered on-site
- Material cost changes
- Scope creep
- Unforeseen complications

---

## Liability Shield: Breakdown Transparency

The `breakdown` field builds trust while protecting margins:

```json
{
  "base_fee": 100,
  "estimated_labor_low": 600,
  "estimated_labor_high": 1100,
  "buffer_applied": "15%"
}
```

**Why this matters:**
- Shows customer where the money goes
- Justifies the price range
- Protects contractor if actual costs are higher
- Demonstrates professionalism

---

## Testing

### Manual Tests

```bash
cd tests
tsx estimate.test.ts
```

This runs 5 test cases:
1. Valid estimate with dimensions
2. Missing dimensions
3. Service not in pricing rules
4. Large project (rounding test)
5. Flat rate service

### Expected Results

**Test 1: Deck Staining (200 sq ft)**
```json
{
  "estimated_range": "$700 - $1,265",
  "is_calculated": true,
  "breakdown": {
    "base_fee": 100,
    "estimated_labor_low": 600,
    "estimated_labor_high": 1100,
    "buffer_applied": "15%"
  }
}
```

**Test 2: Missing Dimensions**
```json
{
  "quote": null,
  "error": "I need more details about the project size..."
}
```

---

## Integration with Lead Service

Update `lead.service.ts` to call the estimate service:

```typescript
import estimateService from './estimate.service';

// After qualification returns next_action: 'generate_quote'
if (qualificationResult.response.next_action === 'generate_quote') {
  const estimateResult = await estimateService.generateEstimate({
    business_context: {
      pricing_rules: customer.pricing_rules,
    },
    lead_data: {
      service: qualificationResult.lead_metadata.service!,
      dimensions: extractDimensions(conversationHistory),
      notes: conversationHistory.map(m => m.content).join(' | '),
    },
  });

  if (estimateResult.error) {
    // Ask for more info or fallback
    return {
      reply_message: estimateResult.error,
      conversation_ended: false,
    };
  }

  // Store quote and end conversation
  await this.updateLeadWithQuote(lead.lead_id, estimateResult.quote);
  return {
    reply_message: estimateResult.quote.assistant_reply,
    quote: estimateResult.quote,
    conversation_ended: true,
  };
}
```

---

## Cost Analysis

### Per-Quote Cost

| Component | Model | Tokens | Cost |
|-----------|-------|--------|------|
| Input (pricing rules + lead data) | Sonnet | ~500 | $0.0015 |
| Output (JSON response) | Sonnet | ~300 | $0.0009 |
| **Total per quote** | | ~800 | **~$0.002** |

### Volume Pricing

| Quotes/Month | Total Cost |
|--------------|-----------|
| 100 | $0.20 |
| 1,000 | $2.00 |
| 10,000 | $20.00 |

**Compare to alternatives:**
- Manual quoting: $5-10 per quote (10-15 min of staff time)
- Automated form: $0 but low conversion rate
- Human chat operator: $15-25/hour

**ROI**: The estimate engine pays for itself after the first lead conversion.

---

## Best Practices

### 1. Conservative Estimates
Always err on the high side. Better to quote high and come in under budget than vice versa.

### 2. Clear Disclaimers
Never guarantee exact prices without an on-site visit. The 15% buffer helps, but unexpected issues happen.

### 3. Breakdown Transparency
Show the customer where their money goes. This builds trust and justifies the price.

### 4. Professional Rounding
Round to $5 or $10 increments. "$1,267" looks calculated (good), "$1,267.43" looks fake (bad).

### 5. Call to Action
Always end with a next step: "Would you like to schedule a visit?" or "Can I send you our availability?"

---

## Common Issues & Solutions

### Issue 1: Quote Too Low

**Problem**: Customer's pricing rules are outdated, quotes are below market rate.

**Solution**: Update pricing rules in database:
```sql
UPDATE customers
SET pricing_rules = jsonb_set(
  pricing_rules,
  '{deck_staining,min}',
  '4.00'
)
WHERE customer_id = 'xxx';
```

### Issue 2: Quote Too High

**Problem**: 15% buffer makes quotes uncompetitive.

**Solution**: Adjust system prompt to use 10% buffer instead of 15%, or remove buffer for certain services.

### Issue 3: Missing Dimensions

**Problem**: Customer didn't provide dimensions, can't calculate quote.

**Solution**: The engine returns an error asking for dimensions. Lead service should loop back and ask the customer.

---

## Monitoring

Track these metrics:

1. **Quote Accuracy**: % of quotes that match final invoice (±20%)
2. **Conversion Rate**: % of quotes that lead to booked jobs
3. **Error Rate**: % of estimates that return errors
4. **Average Quote Value**: Monitor for pricing drift
5. **Time to Quote**: Should be < 3 seconds

### Dashboard Query

```sql
SELECT
  (quote->>'estimated_range') as quote_range,
  (quote->>'is_calculated') as calculated,
  COUNT(*) as total
FROM leads
WHERE quote IS NOT NULL
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY quote_range, calculated
ORDER BY total DESC;
```

---

## Conclusion

The Estimate Engine provides:
- ✅ **Accurate pricing** (Sonnet's math is reliable)
- ✅ **Conservative estimates** (15% buffer protects margins)
- ✅ **Transparency** (breakdown builds trust)
- ✅ **Legal protection** (disclaimers prevent liability)
- ✅ **Professional presentation** (rounded, ranged quotes)
- ✅ **Clear CTAs** (drives conversions)

Use this as the foundation for all quote generation in the widget. Adjust pricing rules per customer, monitor conversion rates, and iterate based on real-world performance.

---

**Next Steps:**
1. Test the service with real pricing rules
2. Integrate with lead.service.ts
3. Add dimension extraction logic
4. Monitor quote accuracy vs actual invoices
5. Adjust pricing rules based on market rates
