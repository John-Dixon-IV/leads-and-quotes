-- Initial database schema for LeadsAndQuotes
-- Multi-tenant SaaS for contractor lead capture via AI chat widget

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Customers table
CREATE TABLE customers (
  customer_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  api_key VARCHAR(64) UNIQUE NOT NULL,
  company_name VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Business configuration (JSONB for flexibility)
  business_info JSONB DEFAULT '{}'::jsonb,
  -- { services: [], service_area: "", contact_info: {} }

  pricing_rules JSONB DEFAULT '{}'::jsonb,
  -- { "deck_repair": { "base_rate_per_sqft": 4.5, "min_charge": 500, "estimated_range": "$800-$1200" } }

  ai_prompts JSONB DEFAULT '{}'::jsonb,
  -- { "system_prompt": "You are...", "greeting": "Hi! How can we help?" }

  -- Metadata
  subscription_tier VARCHAR(50) DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,

  -- Rate limiting config per customer
  rate_limit_messages_per_session INTEGER DEFAULT 10,
  rate_limit_leads_per_day INTEGER DEFAULT 100
);

CREATE INDEX idx_customers_api_key ON customers(api_key) WHERE deleted_at IS NULL;
CREATE INDEX idx_customers_email ON customers(email) WHERE deleted_at IS NULL;

-- Leads table
CREATE TABLE leads (
  lead_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  session_id UUID NOT NULL,

  -- Visitor info (collected progressively)
  visitor_name VARCHAR(255),
  visitor_email VARCHAR(255),
  visitor_phone VARCHAR(50),

  -- AI classification results (JSONB)
  classification JSONB,
  -- { "service_type": "deck_repair", "urgency": "medium", "confidence": 0.89 }

  quote JSONB,
  -- { "estimated_range": "$800-$1200", "factors": ["deck size", "material unknown"], "next_steps": "..." }

  -- Status tracking
  status VARCHAR(50) DEFAULT 'new',
  -- Values: new, qualified, contacted, quoted, won, lost

  needs_review BOOLEAN DEFAULT false,
  -- Flagged when Claude fails or confidence < 0.6

  is_qualified BOOLEAN DEFAULT false,
  -- Set to true when lead has enough info (stops AI conversation)

  message_count INTEGER DEFAULT 0,
  -- Track conversation length (capped at 10)

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Data retention tracking
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '12 months')
);

CREATE INDEX idx_leads_customer_created ON leads(customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_session ON leads(session_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_needs_review ON leads(customer_id, needs_review) WHERE needs_review = true AND deleted_at IS NULL;
CREATE INDEX idx_leads_expires_at ON leads(expires_at) WHERE deleted_at IS NULL;

-- Messages table (conversation history)
CREATE TABLE messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(lead_id) ON DELETE CASCADE,
  sender VARCHAR(20) NOT NULL,
  -- Values: 'visitor', 'ai'

  content TEXT NOT NULL,

  -- Claude API metadata (only for AI messages)
  claude_model VARCHAR(50),
  -- e.g., "claude-haiku-4-5", "claude-sonnet-4-5"

  confidence DECIMAL(3, 2),
  -- Confidence score from classification (0.00 - 1.00)

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Data retention: 90 days
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '90 days'),

  CONSTRAINT chk_sender CHECK (sender IN ('visitor', 'ai'))
);

CREATE INDEX idx_messages_lead_created ON messages(lead_id, created_at ASC) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_expires_at ON messages(expires_at) WHERE deleted_at IS NULL;

-- Follow-ups table (async tasks)
CREATE TABLE followups (
  followup_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(lead_id),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  -- Values: pending, sent, failed

  content TEXT,
  channel VARCHAR(50) DEFAULT 'email',
  -- Values: email, sms, etc.

  trigger_type VARCHAR(50),
  -- Values: inactivity, missing_info

  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT chk_status CHECK (status IN ('pending', 'sent', 'failed')),
  CONSTRAINT chk_channel CHECK (channel IN ('email', 'sms'))
);

CREATE INDEX idx_followups_scheduled_pending ON followups(scheduled_at, status) WHERE status = 'pending' AND deleted_at IS NULL;
CREATE INDEX idx_followups_lead ON followups(lead_id) WHERE deleted_at IS NULL;

-- Widget configuration (appearance and behavior)
CREATE TABLE widget_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID UNIQUE NOT NULL REFERENCES customers(customer_id),

  appearance JSONB DEFAULT '{}'::jsonb,
  -- { "color": "#3B82F6", "logo_url": "https://...", "company_name": "Joe's Contracting" }

  behavior JSONB DEFAULT '{}'::jsonb,
  -- { "greeting": "Hi! How can we help?", "enable_quote_estimates": true }

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_widget_configs_customer ON widget_configs(customer_id) WHERE deleted_at IS NULL;

-- Session tracking for rate limiting
CREATE TABLE sessions (
  session_id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX idx_sessions_customer ON sessions(customer_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_configs_updated_at BEFORE UPDATE ON widget_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
