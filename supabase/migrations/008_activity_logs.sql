-- Migration 008: Create Activity Logs Table for System Audit & Event Tracking

CREATE TABLE IF NOT EXISTS activity_logs (
  id VARCHAR(100) PRIMARY KEY,
  household_id VARCHAR(100) REFERENCES households(id) ON DELETE CASCADE,
  member_id VARCHAR(100),
  member_name VARCHAR(255) NOT NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity logs" ON activity_logs
    FOR SELECT USING (is_household_member(household_id));

CREATE POLICY "Admins can manage activity logs" ON activity_logs
    FOR ALL USING (is_household_admin(household_id));

COMMENT ON TABLE activity_logs IS 'Audit trail logging all household wallet, loan, transaction, and admin actions';
