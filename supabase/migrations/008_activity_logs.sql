-- Migration 008: Create Activity Logs Table for System Audit & Event Tracking

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  household_id UUID REFERENCES households(id) ON DELETE CASCADE,
  member_id VARCHAR(100),
  member_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE activity_logs IS 'Audit trail logging all household wallet, loan, transaction, and admin actions';
