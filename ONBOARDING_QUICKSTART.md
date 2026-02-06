# ⚡ Onboarding Quick Start

**Onboard a new customer in 60 seconds.**

---

## 🚀 Command

```bash
npm run onboard
```

---

## 📝 What You'll Need

1. **Business Name** - "Joe's Deck Repair"
2. **Email** - joe@joesdecks.com
3. **Phone** - 512-555-1234
4. **Timezone** - America/Chicago
5. **Zip Codes** - 60601,60602,60603
6. **Services** - deck_repair,deck_staining
7. **Pricing** - Press Enter for defaults or paste JSON

---

## 🎯 Output

You'll get:
- ✅ Customer ID
- ✅ API Key
- ✅ Widget embed code (copy/paste ready)
- ✅ Welcome package file

---

## 📋 Common Timezones

| City | Timezone |
|------|----------|
| New York | `America/New_York` |
| Chicago | `America/Chicago` |
| Denver | `America/Denver` |
| Los Angeles | `America/Los_Angeles` |
| Austin | `America/Chicago` |
| Phoenix | `America/Phoenix` |

---

## 💰 Default Pricing

If you press Enter for pricing, you get:
- **Base Fee:** $150
- **Rate:** $3.00/sqft
- **Range:** $500 - $5,000

---

## 🔧 Custom Pricing Template

```json
{
  "deck_repair": {
    "base_fee": 150,
    "rate_per_sqft": 3.5,
    "min_estimate": 500,
    "max_estimate": 5000
  },
  "deck_staining": {
    "base_fee": 200,
    "rate_per_sqft": 2.5,
    "min_estimate": 600,
    "max_estimate": 4000
  }
}
```

---

## 📦 Widget Embed Code

After onboarding, you'll get code like this:

```html
<script src="http://localhost:3000/widget.js"></script>
<script>
  window.initLeadsWidget({
    apiKey: 'lnq_abc123...',
    apiBaseUrl: 'http://localhost:3000',
    position: 'bottom-right',
    primaryColor: '#2563eb',
    greeting: 'Hi! Need help with deck repair?'
  });
</script>
```

**Customer pastes this before `</body>` tag on their website.**

---

## ✅ What Gets Enabled

Every customer gets:
- ✅ AI Lead Classification
- ✅ Smart Quote Generation
- ✅ Ghost Buster (Auto Follow-Up)
- ✅ Hot Lead Alerts
- ✅ Weekly Digest
- ✅ Math Sanity Engine
- ✅ Timezone-Aware Office Hours

---

## 🎬 Example 60-Second Onboarding

```bash
$ npm run onboard

Business Name: Joe's Deck Repair
Email: joe@joesdecks.com
Phone: 512-555-1234
Timezone: America/Chicago
Service Area Zip Codes: 60601,60602,60603

Services: deck_repair,deck_staining
Pricing Rules: [Press Enter for defaults]

✅ Customer created successfully!
   API Key: lnq_xyz789...

🎉 WELCOME PACKAGE - JOE'S DECK REPAIR
[Full embed code and instructions printed...]

💾 Welcome package saved to: welcome-package-joes-deck-repair-2026-02-05.txt
```

---

## 🚨 Quick Troubleshooting

| Error | Fix |
|-------|-----|
| Email already exists | Use different email or delete old customer |
| Invalid timezone | Use format: `America/New_York` |
| Database connection failed | Check PostgreSQL running, verify .env |
| Invalid JSON | Validate at jsonlint.com or press Enter |

---

## 📚 Full Documentation

See [ONBOARDING_GUIDE.md](ONBOARDING_GUIDE.md) for complete details.

---

**Ready to onboard your first 5 beta testers?**

```bash
npm run onboard
```

🎯 **Goal:** 5 customers onboarded in 5 minutes!
