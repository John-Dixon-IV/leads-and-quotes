# 🚀 Customer Onboarding Guide

Quick guide for onboarding new customers to your Leads & Quotes SaaS platform.

---

## 📋 Overview

The **Customer Onboarding CLI** is an interactive tool that lets you onboard new beta testers in **under 60 seconds**. No manual database queries, no configuration files—just answer a few questions and get a complete welcome package.

---

## 🎯 Quick Start

```bash
npm run onboard
```

That's it! The CLI will guide you through the entire process.

---

## 📝 Onboarding Process

### Step 1: Basic Information

The CLI will prompt you for:

```
Business Name: Joe's Deck Repair
Email: joe@joesdecks.com
Phone: 512-555-1234
Timezone: America/Chicago
Service Area Zip Codes: 60601,60602,60603
```

**Common Timezones:**
- `America/New_York` (EST/EDT)
- `America/Chicago` (CST/CDT)
- `America/Denver` (MST/MDT)
- `America/Los_Angeles` (PST/PDT)
- `America/Phoenix` (MST - no DST)

### Step 2: Services & Pricing

**Available Services:**
- Deck: `deck_repair`, `deck_staining`, `deck_cleaning`
- Fence: `fence_repair`, `fence_staining`, `fence_installation`
- Patio: `patio_repair`, `patio_installation`, `patio_cleaning`
- Gutter: `gutter_cleaning`, `gutter_repair`, `gutter_installation`
- Other: `pressure_washing`, `window_cleaning`, `roof_repair`

**Example Input:**
```
Services: deck_repair,deck_staining,fence_repair
```

**Pricing Rules (JSON):**

You can either:
1. **Press Enter** for default pricing ($150 base, $3/sqft, $500-$5000 range)
2. **Paste custom JSON** with specific pricing for each service

**Custom Pricing Example:**
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
  },
  "fence_repair": {
    "base_fee": 100,
    "rate_per_sqft": 4.0,
    "min_estimate": 400,
    "max_estimate": 3500
  }
}
```

### Step 3: Customer Creation

The CLI will:
- ✅ Generate a secure API key (`lnq_...`)
- ✅ Save customer to database
- ✅ Configure AI prompts automatically
- ✅ Enable Ghost Buster, hot lead alerts, and weekly digest

---

## 📦 Welcome Package

After onboarding, you'll receive a **complete welcome package** including:

### 1. Customer Details
- Customer ID
- API Key (for widget authentication)
- All configured services and pricing

### 2. Widget Embed Code
Ready-to-use `<script>` tag:

```html
<!-- Leads & Quotes AI Chat Widget -->
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

### 3. API Endpoints
- Widget API
- Dashboard API
- Health check endpoint

### 4. Features Enabled
- AI-Powered Lead Classification ✅
- Smart Quote Generation ✅
- Ghost Buster (Automated Follow-Up) ✅
- Hot Lead Alerts (SMS/Email) ✅
- Weekly Performance Digest ✅
- Math Sanity Engine ✅
- Timezone-Aware Office Hours ✅

### 5. Next Steps
Clear instructions for:
1. Adding widget to website
2. Configuring SMS alerts
3. Testing the widget
4. Monitoring leads

---

## 💾 Saved Files

Each onboarding creates a timestamped file:

```
welcome-package-joes-deck-repair-2026-02-05.txt
```

This file contains:
- Customer details
- API key
- Embed code
- Full welcome package

**Keep this file safe!** It contains the customer's API key.

---

## 🎬 Example Session

```bash
$ npm run onboard

╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║        LEADS & QUOTES - CUSTOMER ONBOARDING CLI           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

Welcome! Let's get your new customer set up in 60 seconds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 STEP 1: Basic Information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Business Name: Joe's Deck Repair
Email: joe@joesdecks.com
Phone: 512-555-1234

💡 Tip: Common timezones: America/New_York, America/Chicago...
Timezone: America/Chicago
Service Area Zip Codes: 60601,60602,60603

✅ Basic information collected!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 STEP 2: Services & Pricing Rules
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Services: deck_repair,deck_staining

Pricing Rules (paste JSON or press Enter for defaults): [Enter]
✅ Using default pricing for all services.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💾 STEP 3: Creating Customer Account
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Customer created successfully!
   Customer ID: cust_abc123...
   API Key: lnq_xyz789...

═══════════════════════════════════════════════════════════
🎉 WELCOME PACKAGE - JOE'S DECK REPAIR
═══════════════════════════════════════════════════════════

[Full welcome package printed here...]

💾 Welcome package saved to: welcome-package-joes-deck-repair-2026-02-05.txt

✅ Onboarding complete! Customer is ready to go.
```

---

## 🔧 Customization Options

### Widget Configuration

You can customize the widget embed code:

**Position:**
```javascript
position: 'bottom-right'  // or 'bottom-left'
```

**Branding:**
```javascript
primaryColor: '#2563eb'   // Your brand color (hex)
greeting: 'Hi! How can I help you today?'
```

**Advanced:**
```javascript
window.initLeadsWidget({
  apiKey: 'lnq_...',
  apiBaseUrl: 'https://your-domain.com',
  position: 'bottom-right',
  primaryColor: '#10b981',
  greeting: 'Need a quote for deck repair?',
  // Optional: Custom labels
  placeholder: 'Type your message...',
  submitButtonText: 'Send',
  // Optional: Auto-open after delay
  autoOpen: true,
  autoOpenDelay: 3000  // 3 seconds
});
```

### SMS/Email Alerts

To enable hot lead alerts, configure in `.env`:

```bash
# Twilio SMS (optional)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_FROM=+15125551234

# SendGrid Email (optional)
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=alerts@leadsandquotes.com
```

Then update customer's phone/email in the database or during onboarding.

---

## 🚨 Troubleshooting

### "Email already exists in database"

**Problem:** Customer with that email already onboarded.

**Solution:** Use a different email or delete the existing customer:

```sql
DELETE FROM customers WHERE email = 'joe@example.com';
```

### "Invalid timezone"

**Problem:** Timezone format is incorrect.

**Valid formats:**
- `America/New_York` ✅
- `America/Chicago` ✅
- `EST` ❌ (use America/New_York)
- `PST` ❌ (use America/Los_Angeles)

**Full list:** https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

### "Invalid JSON format"

**Problem:** Pricing rules JSON is malformed.

**Solution:** Validate your JSON:
1. Use https://jsonlint.com to validate
2. Or press Enter to use default pricing
3. Fix syntax errors (missing commas, quotes, brackets)

### Database Connection Failed

**Problem:** Can't connect to PostgreSQL.

**Solution:**
1. Ensure PostgreSQL is running
2. Check `.env` has correct `DATABASE_URL`
3. Run migrations: `npm run migrate`

---

## 📊 Onboarding Beta Testers

### Best Practices

1. **Start with 5 beta testers**
   - Test different service types (decks, fences, patios)
   - Use different timezones to test Ghost Buster
   - Monitor results in first 2 weeks

2. **Provide clear instructions**
   - Send them the welcome package file
   - Help them embed the widget
   - Set expectations for AI behavior

3. **Monitor performance**
   - Check admin stats: `npm run verify:admin`
   - Review weekly digest emails
   - Track Ghost Buster recovery rates

4. **Gather feedback**
   - Are quotes accurate?
   - Is the AI professional and helpful?
   - Are follow-ups timely?

### Example Beta Tester List

```
1. Joe's Deck Repair (Chicago, IL) - deck_repair, deck_staining
2. Austin Fence Co (Austin, TX) - fence_repair, fence_installation
3. Denver Patio Masters (Denver, CO) - patio_repair, patio_installation
4. NYC Gutter Pros (New York, NY) - gutter_cleaning, gutter_repair
5. LA Pressure Wash (Los Angeles, CA) - pressure_washing, window_cleaning
```

**Timezone Coverage:**
- Chicago: America/Chicago (CST)
- Austin: America/Chicago (CST)
- Denver: America/Denver (MST)
- NYC: America/New_York (EST)
- LA: America/Los_Angeles (PST)

---

## 🎯 Next Steps After Onboarding

### For You (Platform Owner)

1. **Monitor admin dashboard:**
   ```bash
   curl -H "x-admin-secret: YOUR_SECRET" \
     http://localhost:3000/api/v1/admin/stats
   ```

2. **Track beta tester performance:**
   - Lead capture rate
   - Quote conversion rate
   - Ghost Buster recovery rate
   - Customer satisfaction

3. **Iterate based on feedback:**
   - Adjust pricing rules
   - Refine AI prompts
   - Improve quote accuracy

### For Customer (Beta Tester)

1. **Install widget on website**
2. **Test with sample messages**
3. **Monitor leads in dashboard** (if dashboard UI exists)
4. **Respond to hot lead alerts**
5. **Review weekly digest emails**

---

## 📚 Additional Resources

- [PROJECT_COMPLETE.md](PROJECT_COMPLETE.md) - Complete feature list
- [VERIFICATION_GUIDE.md](VERIFICATION_GUIDE.md) - Testing and validation
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment
- [README.md](README.md) - Project overview

---

**Last Updated:** February 5, 2026
**Version:** 1.0.0

**Ready to onboard your first customer?**

```bash
npm run onboard
```
