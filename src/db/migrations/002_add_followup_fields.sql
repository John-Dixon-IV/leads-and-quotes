-- Add follow-up tracking fields to leads table

-- Add follow_up_sent flag to prevent duplicate nudges
ALTER TABLE leads
ADD COLUMN follow_up_sent BOOLEAN DEFAULT false;

-- Add is_complete flag to track lead completion
ALTER TABLE leads
ADD COLUMN is_complete BOOLEAN DEFAULT false;

-- Add stopped flag for users who said "nevermind"
ALTER TABLE leads
ADD COLUMN stopped BOOLEAN DEFAULT false;

-- Add timezone for office hours check (defaults to Central Time)
ALTER TABLE customers
ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/Chicago';

-- Create index for efficient worker queries
CREATE INDEX idx_leads_incomplete_followup ON leads(is_complete, follow_up_sent, updated_at)
WHERE is_complete = false AND follow_up_sent = false AND stopped = false AND deleted_at IS NULL;

-- Create index for follow-up scheduling
CREATE INDEX idx_followups_pending ON followups(scheduled_at, status)
WHERE status = 'pending' AND deleted_at IS NULL;

COMMENT ON COLUMN leads.follow_up_sent IS 'True if automated nudge has been sent (one-and-done rule)';
COMMENT ON COLUMN leads.is_complete IS 'True if lead has provided all required info (service + phone + address)';
COMMENT ON COLUMN leads.stopped IS 'True if user said "nevermind" or "stop" (do not send follow-ups)';
COMMENT ON COLUMN customers.timezone IS 'Timezone for office hours check (e.g., America/Chicago, America/New_York)';
