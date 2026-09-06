-- Migration 017: Repair production schema drift for custom member roles
-- This is safe to run on an existing database. It only adds missing role metadata.

ALTER TABLE IF EXISTS household_members
  ADD COLUMN IF NOT EXISTS role_id VARCHAR(100);

CREATE TABLE IF NOT EXISTS household_roles (
  id VARCHAR(100) PRIMARY KEY,
  household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  base_role VARCHAR(50) NOT NULL CHECK (base_role IN ('admin', 'parent_member', 'member')),
  is_head_parent BOOLEAN DEFAULT FALSE NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id VARCHAR(160) PRIMARY KEY,
  household_id VARCHAR(100) NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  role_id VARCHAR(100) NOT NULL REFERENCES household_roles(id) ON DELETE CASCADE,
  permission_key VARCHAR(80) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('allowed', 'own_only', 'read_only', 'restricted')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (role_id, permission_key)
);

ALTER TABLE IF EXISTS household_members DROP CONSTRAINT IF EXISTS household_members_role_id_fkey;
ALTER TABLE household_members
  ADD CONSTRAINT household_members_role_id_fkey
  FOREIGN KEY (role_id) REFERENCES household_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_household_roles_household ON household_roles(household_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_household ON role_permissions(household_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);

ALTER TABLE household_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON household_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON role_permissions TO authenticated;

DROP POLICY IF EXISTS "Members can view household roles" ON household_roles;
DROP POLICY IF EXISTS "Admins can manage household roles" ON household_roles;
DROP POLICY IF EXISTS "Members can view role permissions" ON role_permissions;
DROP POLICY IF EXISTS "Admins can manage role permissions" ON role_permissions;

CREATE POLICY "Members can view household roles" ON household_roles
  FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Admins can manage household roles" ON household_roles
  FOR ALL TO authenticated
  USING (is_household_admin(household_id))
  WITH CHECK (is_household_admin(household_id));

CREATE POLICY "Members can view role permissions" ON role_permissions
  FOR SELECT TO authenticated
  USING (is_household_member(household_id));

CREATE POLICY "Admins can manage role permissions" ON role_permissions
  FOR ALL TO authenticated
  USING (is_household_admin(household_id))
  WITH CHECK (is_household_admin(household_id));

INSERT INTO household_roles (id, household_id, name, base_role, is_head_parent, is_default) VALUES
('role-admin-head-parent', 'hh-101', 'Admin (Head Parent)', 'admin', TRUE, TRUE),
('role-parent-guardian', 'hh-101', 'Member (Parent/Guardian)', 'parent_member', FALSE, TRUE),
('role-teen-dependent', 'hh-101', 'Member (Teen/Dependent)', 'member', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    base_role = EXCLUDED.base_role,
    is_head_parent = EXCLUDED.is_head_parent,
    is_default = EXCLUDED.is_default;

UPDATE household_members
SET role_id = CASE
  WHEN role = 'admin' THEN 'role-admin-head-parent'
  WHEN role = 'parent_member' THEN 'role-parent-guardian'
  ELSE 'role-teen-dependent'
END
WHERE role_id IS NULL;

WITH permissions(permission_key) AS (
  VALUES
    ('create_transactions'),
    ('update_transactions'),
    ('delete_transactions'),
    ('manage_wallets'),
    ('manage_categories'),
    ('manage_goals'),
    ('fund_goals'),
    ('manage_loans'),
    ('pay_loans'),
    ('manage_schedules'),
    ('manage_members'),
    ('send_password_resets'),
    ('manage_roles'),
    ('export_backup'),
    ('restore_backup'),
    ('reset_demo_data'),
    ('view_activity_logs')
),
seeded AS (
  SELECT
    role.id AS role_id,
    role.household_id,
    permissions.permission_key,
    CASE
      WHEN role.id = 'role-admin-head-parent' THEN 'allowed'
      WHEN role.id = 'role-parent-guardian'
        AND permissions.permission_key IN (
          'create_transactions', 'update_transactions', 'delete_transactions',
          'manage_wallets', 'manage_categories', 'manage_goals', 'fund_goals',
          'manage_loans', 'pay_loans', 'manage_schedules', 'manage_members',
          'send_password_resets', 'export_backup', 'restore_backup', 'view_activity_logs'
        ) THEN 'allowed'
      WHEN role.id = 'role-teen-dependent'
        AND permissions.permission_key IN ('create_transactions', 'update_transactions', 'delete_transactions', 'fund_goals', 'pay_loans') THEN 'own_only'
      WHEN role.id = 'role-teen-dependent'
        AND permissions.permission_key IN ('manage_wallets', 'manage_categories', 'manage_goals', 'manage_loans', 'manage_schedules', 'view_activity_logs') THEN 'read_only'
      ELSE 'restricted'
    END AS level
  FROM household_roles role
  CROSS JOIN permissions
  WHERE role.id IN ('role-admin-head-parent', 'role-parent-guardian', 'role-teen-dependent')
)
INSERT INTO role_permissions (id, household_id, role_id, permission_key, level)
SELECT role_id || '-' || permission_key, household_id, role_id, permission_key, level
FROM seeded
ON CONFLICT (role_id, permission_key) DO NOTHING;
