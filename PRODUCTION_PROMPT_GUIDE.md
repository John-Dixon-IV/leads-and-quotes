# Production Lead Qualification Prompt

This guide documents the production-grade prompt structure for the LeadsAndQuotes widget.

## Overview

The production prompt is optimized for **deterministic, safe, and cost-effective lead qualification** in a customer-facing SaaS environment.

## Key Design Principles

1. **Structured Output**: Always return machine-readable JSON
2. **Progressive Disclosure**: Ask for ONE piece of missing info at a time
3. **Service Area Validation**: Immediately flag out-of-area leads
4. **Urgency Detection**: High scores (0.9+) for safety hazards
5. **Junk Filtering**: Detect and classify spam, bots, solicitors
6. **Concise Responses**: Keep AI replies under 2 sentences when asking for info

---

## Production System Prompt

```
You are a Lead Qualification engine for [COMPANY_NAME], a home services company.

Your goal is to extract lead data and generate a structured JSON response.

AVAILABLE SERVICES: [deck_repair, fence_install, roofing, etc.]
SERVICE AREA: [Austin, TX and surrounding areas]

STRICT RULES:
1. Respond ONLY with valid JSON matching the exact schema provided.
2. If the user's location is not in SERVICE AREA, set 'is_out_of_area': true.
3. Priority for missing info: 1. Service Type, 2. Phone Number, 3. Address.
   Ask for ONLY ONE missing item at a time.
4. Set 'urgency_score' to 0.9+ for active leaks, sparks, electrical issues,
   or safety hazards.
5. Set 'urgency_score' to 0.5-0.7 for routine maintenance or non-urgent repairs.
6. If the user is clearly a bot, solicitor, spam, or unrelated inquiry,
   set 'category': "Junk".
7. Extract service type from the conversation. If unclear, ask a clarifying question.
8. Once you have service type + phone number + address, set next_action to 'generate_quote'.
9. For emergencies (urgency_score >= 0.9), set next_action to 'emergency_handoff'.
10. Be concise and professional. Keep replies under 2 sentences when asking for info.

NEXT ACTIONS:
- 'ask_info': Missing critical information (service, phone, or address)
- 'generate_quote': Have all info needed for estimate
- 'emergency_handoff': Urgent safety issue requiring immediate human contact
- 'close': Junk lead or out of area

DO NOT:
- Invent prices or make up service offerings
- Provide quotes in this step (that happens separately)
- Be verbose or chatty
- Ask multiple questions at once
```

---

## Output Schema

```json
{
  "lead_metadata": {
    "name": "string|null",
    "phone": "string|null",
    "address": "string|null",
    "service": "string|null"
  },
  "classification": {
    "category": "New Lead|Junk",
    "urgency_score": 0.0,
    "is_out_of_area": false
  },
  "response": {
    "assistant_reply": "string",
    "next_action": "ask_info|emergency_handoff|close|generate_quote"
  }
}
```

---

## Example Conversations

### Example 1: First Contact - Missing Info

**Visitor**: "I need my deck fixed"

**AI Response**:
```json
{
  "lead_metadata": {
    "name": null,
    "phone": null,
    "address": null,
    "service": "deck_repair"
  },
  "classification": {
    "category": "New Lead",
    "urgency_score": 0.5,
    "is_out_of_area": false
  },
  "response": {
    "assistant_reply": "I can help with deck repairs! What's the best phone number to reach you?",
    "next_action": "ask_info"
  }
}
```

---

### Example 2: Emergency Handoff

**Visitor**: "My ceiling is leaking water everywhere, please help!"

**AI Response**:
```json
{
  "lead_metadata": {
    "name": null,
    "phone": null,
    "address": null,
    "service": "emergency_plumbing"
  },
  "classification": {
    "category": "New Lead",
    "urgency_score": 0.95,
    "is_out_of_area": false
  },
  "response": {
    "assistant_reply": "This is urgent! Please call us immediately at [EMERGENCY_PHONE]. What's your address so we can send help?",
    "next_action": "emergency_handoff"
  }
}
```

---

### Example 3: Out of Area

**Visitor**: "I need fence installation in Houston"

**AI Response**:
```json
{
  "lead_metadata": {
    "name": null,
    "phone": null,
    "address": "Houston, TX",
    "service": "fence_installation"
  },
  "classification": {
    "category": "New Lead",
    "urgency_score": 0.5,
    "is_out_of_area": true
  },
  "response": {
    "assistant_reply": "Thanks for reaching out! Unfortunately, we only service the Austin area. I recommend searching for local fence contractors in Houston.",
    "next_action": "close"
  }
}
```

---

### Example 4: Junk Lead

**Visitor**: "Hey! I'm selling SEO services for contractors, interested?"

**AI Response**:
```json
{
  "lead_metadata": {
    "name": null,
    "phone": null,
    "address": null,
    "service": null
  },
  "classification": {
    "category": "Junk",
    "urgency_score": 0.0,
    "is_out_of_area": false
  },
  "response": {
    "assistant_reply": "We're not interested in SEO services at this time. Thanks!",
    "next_action": "close"
  }
}
```

---

### Example 5: Ready for Quote

**Visitor**: "My name is John, phone is 512-555-1234, I live at 123 Main St Austin. Need deck repair, about 200 sqft."

**AI Response**:
```json
{
  "lead_metadata": {
    "name": "John",
    "phone": "512-555-1234",
    "address": "123 Main St, Austin",
    "service": "deck_repair"
  },
  "classification": {
    "category": "New Lead",
    "urgency_score": 0.5,
    "is_out_of_area": false
  },
  "response": {
    "assistant_reply": "Thanks John! Let me get you an estimate for that 200 sqft deck repair.",
    "next_action": "generate_quote"
  }
}
```

---

## Progressive Information Collection

The AI follows this priority order:

1. **Service Type** (required to classify the lead)
2. **Phone Number** (critical for follow-up)
3. **Address** (needed for service area validation and quote accuracy)
4. **Name** (nice to have, but not blocking)

**Only ask for ONE missing item per turn.**

### Bad Example (asking multiple questions):
> "Thanks for reaching out! What service do you need? Also, what's your phone number and address?"

### Good Example (one question at a time):
> "I can help! What service are you looking for?"

---

## Urgency Score Guidelines

| Score | Type | Examples |
|-------|------|----------|
| 0.9-1.0 | **Emergency** | Active leaks, electrical sparks, gas smell, structural collapse |
| 0.7-0.8 | **Urgent** | Broken AC in summer, no heat in winter, major water damage |
| 0.5-0.6 | **Standard** | Routine repairs, maintenance, upgrades |
| 0.0-0.4 | **Low Priority** | Cosmetic issues, quote requests, general inquiries |

Emergency leads (0.9+) trigger `emergency_handoff` action.

---

## Next Action Decision Tree

```
Start
  │
  ├─ Is this junk/spam? ───────────────────> next_action: 'close'
  │
  ├─ Is out of service area? ──────────────> next_action: 'close'
  │
  ├─ Is urgency_score >= 0.9? ─────────────> next_action: 'emergency_handoff'
  │
  ├─ Missing service/phone/address? ───────> next_action: 'ask_info'
  │
  └─ Have service + phone + address ───────> next_action: 'generate_quote'
```

---

## Backend Integration

The production prompt is implemented in:
- **[src/services/claude.service.production.ts](src/services/claude.service.production.ts)** - New production service

To use the production prompt instead of the basic one:

```typescript
import productionClaudeService from './services/claude.service.production';

// In lead.service.ts, replace:
const result = await claudeService.classifyLead(request);

// With:
const result = await productionClaudeService.qualifyLead(request);
```

---

## Testing the Production Prompt

### Test Case 1: Missing Phone
```
Message: "I need deck repair"
Expected:
- service: "deck_repair"
- next_action: "ask_info"
- assistant_reply asks for phone number
```

### Test Case 2: Out of Area
```
Message: "I'm in Dallas, need roofing"
Expected:
- is_out_of_area: true
- next_action: "close"
- assistant_reply politely declines
```

### Test Case 3: Emergency
```
Message: "My basement is flooding!"
Expected:
- urgency_score: >= 0.9
- next_action: "emergency_handoff"
- assistant_reply includes urgent contact info
```

### Test Case 4: Spam
```
Message: "Want to buy backlinks?"
Expected:
- category: "Junk"
- next_action: "close"
```

---

## Benefits Over Generic Prompt

| Feature | Generic Prompt | Production Prompt |
|---------|---------------|------------------|
| Output format | Flexible | Strict JSON schema |
| Info collection | All at once | One item at a time |
| Service area check | Manual | Automatic flag |
| Urgency detection | Generic "low/medium/high" | Numeric 0-1 scale |
| Spam filtering | None | Automatic junk detection |
| Emergency handling | None | Dedicated handoff action |
| Verbosity | Can be chatty | Concise (< 2 sentences) |
| Next action guidance | Implicit | Explicit enum |

---

## Cost Optimization

- **Classification**: Use Haiku (~$0.25/MTok) - fast, cheap, sufficient for structured extraction
- **Quote Generation**: Use Sonnet (~$3/MTok) - better reasoning for price estimates
- **Fallback**: Return generic response instead of retrying expensive models

Expected cost per lead capture: **~$0.001 - $0.005**

---

## Monitoring & Iteration

Track these metrics to improve the prompt:

1. **Junk Detection Rate**: % of leads marked as "Junk"
2. **Out-of-Area Rate**: % flagged as out of service area
3. **Average Turns to Qualification**: How many messages to get service + phone + address
4. **Emergency Escalation Rate**: % of high urgency scores
5. **Confidence Scores**: Are we hitting the 0.6 threshold?

Adjust prompt based on:
- False positives in junk detection
- Missed emergencies (urgency too low)
- Too many turns to qualification (prompt being too cautious)

---

## Migration Plan

1. **Phase 1**: Deploy production prompt alongside existing prompt
2. **Phase 2**: A/B test on 10% of traffic
3. **Phase 3**: Monitor metrics (qualification rate, turns to quote, junk detection)
4. **Phase 4**: Full rollout if metrics improve
5. **Phase 5**: Deprecate old prompt

---

## Conclusion

The production prompt is **optimized for SaaS lead capture**:
- ✅ Deterministic JSON output
- ✅ Progressive info collection
- ✅ Service area filtering
- ✅ Urgency scoring
- ✅ Junk detection
- ✅ Concise, professional tone
- ✅ Cost-optimized (Haiku for qualification, Sonnet for quotes)

Use this as the foundation for all customer-facing AI interactions in the widget.
