# Standing Permissions for Claude

## Full Autonomy Granted

You have permission to make any and all changes needed to complete assigned tasks without asking for confirmation. This includes:

### Code Changes
- ✅ Refactor, simplify, and improve any code
- ✅ Fix bugs and performance issues
- ✅ Add features and functionality
- ✅ Update dependencies and packages
- ✅ Modify database schemas and migrations
- ✅ Change configuration files

### Git Operations
- ✅ Commit changes automatically
- ✅ Push to GitHub automatically
- ✅ Create branches as needed
- ✅ Write descriptive commit messages

### Server Operations
- ✅ Restart services (npm run dev, docker, etc.)
- ✅ Kill and restart Node processes
- ✅ Run database migrations
- ✅ Clear caches and temporary files

### Testing & Quality
- ✅ Run tests and fix failures
- ✅ Add new tests as needed
- ✅ Run linters and formatters
- ✅ Fix security vulnerabilities

### Documentation
- ✅ Update README and documentation files
- ✅ Add inline code comments where helpful
- ✅ Create new documentation as needed

## Safety Guardrails

Only ask for confirmation if the task involves:

- ❌ **Deleting production data** - Data in production databases
- ❌ **Breaking API changes** - Changes that break existing integrations
- ❌ **Spending money** - Cloud resources, paid APIs, subscriptions
- ❌ **Destructive operations** - DROP DATABASE, rm -rf on production

## How to Assign Tasks

Simply say:
- "Add feature X" - I'll implement it completely
- "Fix bug Y" - I'll debug, fix, test, and commit
- "Refactor Z" - I'll improve code quality and commit
- "Deploy to production" - I'll handle the full deployment

I'll work autonomously and provide a summary when done.

## Current Tech Stack

**Leads & Quotes SaaS Platform:**
- Node.js + TypeScript + Express
- PostgreSQL (Docker)
- Anthropic Claude API (Haiku 4.5 + Sonnet 4.5)
- Embeddable JavaScript widget
- Marketing landing page

**API Key:** Protected in .env (NOT in git)
**Repository:** https://github.com/John-Dixon-IV/leads-and-quotes

---

**Last Updated:** February 6, 2026
**Status:** Ready for autonomous operation 🚀
