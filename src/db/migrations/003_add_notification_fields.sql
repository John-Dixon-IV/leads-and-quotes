-- Add notification preferences to customers table

ALTER TABLE customers
ADD COLUMN notification_email TEXT,
ADD COLUMN notification_phone TEXT,
ADD COLUMN alert_on_hot_lead BOOLEAN DEFAULT true,
ADD COLUMN weekly_digest_enabled BOOLEAN DEFAULT true,
ADD COLUMN weekly_digest_day INTEGER DEFAULT 1, -- 0 = Sunday, 1 = Monday, etc.
ADD COLUMN weekly_digest_hour INTEGER DEFAULT 8; -- 8 AM local time

-- Add last digest timestamp to track when reports were sent
ALTER TABLE customers
ADD COLUMN last_digest_sent_at TIMESTAMP WITH TIME ZONE;

-- Create notifications table for tracking sent alerts
CREATE TABLE notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id),
  lead_id UUID REFERENCES leads(lead_id),

  notification_type VARCHAR(50) NOT NULL,
  -- Values: 'hot_lead_sms', 'hot_lead_email', 'weekly_digest', 'emergency_alert'

  channel VARCHAR(20) NOT NULL,
  -- Values: 'email', 'sms', 'push'

  recipient TEXT NOT NULL,
  -- Email address or phone number

  subject TEXT,
  content TEXT NOT NULL,

  status VARCHAR(20) DEFAULT 'pending',
  -- Values: 'pending', 'sent', 'failed'

  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT chk_notification_type CHECK (notification_type IN ('hot_lead_sms', 'hot_lead_email', 'weekly_digest', 'emergency_alert')),
  CONSTRAINT chk_channel CHECK (channel IN ('email', 'sms', 'push')),
  CONSTRAINT chk_status CHECK (status IN ('pending', 'sent', 'failed'))
);

CREATE INDEX idx_notifications_customer ON notifications(customer_id, created_at DESC);
CREATE INDEX idx_notifications_status ON notifications(status) WHERE status = 'pending';

COMMENT ON TABLE notifications IS 'Log of all notifications sent to customers';
COMMENT ON COLUMN customers.notification_email IS 'Email for receiving hot lead alerts and weekly digests';
COMMENT ON COLUMN customers.notification_phone IS 'Phone number for SMS alerts (E.164 format: +1234567890)';
COMMENT ON COLUMN customers.alert_on_hot_lead IS 'Send immediate notification when hot lead (urgency > 0.8) arrives';
COMMENT ON COLUMN customers.weekly_digest_enabled IS 'Send weekly performance digest every Monday';
