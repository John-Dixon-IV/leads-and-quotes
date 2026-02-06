-- Commercial Layer Fields
-- Adds partner referral and revenue tracking capabilities

-- Add partner referral fields to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_out_of_area BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS referral_partner_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS referral_sent_at TIMESTAMP WITH TIME ZONE;

-- Add revenue tracking to leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS estimated_revenue DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS actual_revenue DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS qbo_exported BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS qbo_exported_at TIMESTAMP WITH TIME ZONE;

-- Add timezone field to customers (for office hours enforcement)
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'America/Chicago';

-- Add partner referral info to customers.business_info
-- Structure: {
--   partner_referral_info: {
--     partner_name: "ABC Contracting",
--     partner_phone: "512-555-9999",
--     partner_email: "contact@abccontracting.com",
--     referral_fee_percent: 10
--   }
-- }

-- Add notification preferences
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS alert_on_hot_lead BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS notification_phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMP WITH TIME ZONE;

-- Add follow-up tracking to leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS follow_up_sent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS stopped BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_complete BOOLEAN DEFAULT false;

-- Create notifications table for logging
CREATE TABLE IF NOT EXISTS notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  lead_id UUID REFERENCES leads(lead_id),
  notification_type VARCHAR(50) NOT NULL,
  -- Values: hot_lead_sms, hot_lead_email, weekly_digest, homeowner_confirmation, partner_referral
  channel VARCHAR(50) NOT NULL,
  -- Values: sms, email
  recipient VARCHAR(255) NOT NULL,
  subject VARCHAR(500),
  content TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  -- Values: pending, sent, failed
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_customer ON notifications(customer_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_lead ON notifications(lead_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status = 'pending' AND deleted_at IS NULL;

-- Create metrics table for admin dashboard
CREATE TABLE IF NOT EXISTS metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  metric_date DATE NOT NULL,

  -- Lead metrics
  leads_captured INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,

  -- Revenue metrics
  estimated_revenue DECIMAL(10, 2) DEFAULT 0,
  actual_revenue DECIMAL(10, 2) DEFAULT 0,

  -- AI usage metrics
  ai_api_calls INTEGER DEFAULT 0,
  ai_cost_usd DECIMAL(10, 4) DEFAULT 0,

  -- Ghost Buster metrics
  ghost_buster_sent INTEGER DEFAULT 0,
  ghost_buster_recovered INTEGER DEFAULT 0,

  -- Partner referral metrics
  referrals_sent INTEGER DEFAULT 0,
  referral_revenue DECIMAL(10, 2) DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(customer_id, metric_date)
);

CREATE INDEX idx_metrics_customer_date ON metrics(customer_id, metric_date DESC);
CREATE INDEX idx_metrics_date ON metrics(metric_date DESC);

-- Trigger for metrics table
CREATE TRIGGER update_metrics_updated_at BEFORE UPDATE ON metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE notifications IS 'Logs all outbound notifications (SMS, email) for audit and debugging';
COMMENT ON TABLE metrics IS 'Daily aggregated metrics for admin dashboard and revenue tracking';
COMMENT ON COLUMN leads.is_out_of_area IS 'True if visitor location is outside service area';
COMMENT ON COLUMN leads.referral_sent IS 'True if lead was referred to partner business';
COMMENT ON COLUMN leads.estimated_revenue IS 'High-end of quote estimate for revenue tracking';
COMMENT ON COLUMN leads.qbo_exported IS 'True if lead was exported to QuickBooks Online';
