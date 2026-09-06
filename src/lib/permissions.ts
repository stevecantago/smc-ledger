import {
  HouseholdCustomRole,
  HouseholdMember,
  HouseholdRole,
  PermissionKey,
  PermissionLevel,
  RolePermission,
} from '../types/database';

export const DEFAULT_ROLES: HouseholdCustomRole[] = [
  {
    id: 'role-admin-head-parent',
    household_id: 'hh-101',
    name: 'Admin (Head Parent)',
    base_role: 'admin',
    is_head_parent: true,
    is_default: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'role-parent-guardian',
    household_id: 'hh-101',
    name: 'Member (Parent/Guardian)',
    base_role: 'parent_member',
    is_head_parent: false,
    is_default: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'role-teen-dependent',
    household_id: 'hh-101',
    name: 'Member (Teen/Dependent)',
    base_role: 'member',
    is_head_parent: false,
    is_default: true,
    created_at: new Date().toISOString(),
  },
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  create_transactions: 'Log transactions',
  update_transactions: 'Edit transactions',
  delete_transactions: 'Delete transactions',
  manage_wallets: 'Manage wallets and credit lines',
  manage_categories: 'Manage envelope budgets',
  manage_goals: 'Manage savings goals',
  fund_goals: 'Fund savings goals',
  manage_loans: 'Manage loans',
  pay_loans: 'Pay loan amortizations',
  manage_schedules: 'Manage recurring schedules',
  manage_members: 'Invite and edit members',
  send_password_resets: 'Send password reset emails',
  manage_roles: 'Manage role permissions',
  export_backup: 'Export household backup',
  restore_backup: 'Restore household backup',
  reset_demo_data: 'Reset demo data',
  view_activity_logs: 'View activity logs',
};

export const PERMISSION_KEYS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

const parentAllowed: PermissionKey[] = [
  'create_transactions',
  'update_transactions',
  'delete_transactions',
  'manage_wallets',
  'manage_categories',
  'manage_goals',
  'fund_goals',
  'manage_loans',
  'pay_loans',
  'manage_schedules',
  'manage_members',
  'send_password_resets',
  'export_backup',
  'restore_backup',
  'view_activity_logs',
];

const teenOwnOnly: PermissionKey[] = [
  'create_transactions',
  'update_transactions',
  'delete_transactions',
  'fund_goals',
  'pay_loans',
];

export const DEFAULT_ROLE_PERMISSIONS: RolePermission[] = DEFAULT_ROLES.flatMap(role =>
  PERMISSION_KEYS.map(permissionKey => {
    let level: PermissionLevel = 'restricted';

    if (role.is_head_parent) {
      level = 'allowed';
    } else if (role.base_role === 'parent_member') {
      level = parentAllowed.includes(permissionKey) ? 'allowed' : 'restricted';
    } else if (teenOwnOnly.includes(permissionKey)) {
      level = 'own_only';
    } else if (['manage_wallets', 'manage_categories', 'manage_goals', 'manage_loans', 'manage_schedules', 'view_activity_logs'].includes(permissionKey)) {
      level = 'read_only';
    }

    return {
      id: `${role.id}-${permissionKey}`,
      household_id: role.household_id,
      role_id: role.id,
      permission_key: permissionKey,
      level,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  })
);

const legacyRoleMap: Record<HouseholdRole, string> = {
  admin: 'role-admin-head-parent',
  parent_member: 'role-parent-guardian',
  member: 'role-teen-dependent',
};

export function getEffectiveRoleId(member: HouseholdMember): string {
  return member.role_id || legacyRoleMap[member.role];
}

export function isHeadParent(member: HouseholdMember, roles: HouseholdCustomRole[] = DEFAULT_ROLES): boolean {
  const role = roles.find(item => item.id === getEffectiveRoleId(member));
  return Boolean(role?.is_head_parent || member.role === 'admin');
}

export function getPermissionLevel(
  member: HouseholdMember,
  permissions: RolePermission[],
  key: PermissionKey,
  roles: HouseholdCustomRole[] = DEFAULT_ROLES
): PermissionLevel {
  if (isHeadParent(member, roles)) return 'allowed';
  return permissions.find(permission =>
    permission.role_id === getEffectiveRoleId(member) && permission.permission_key === key
  )?.level || 'restricted';
}

export function hasPermission(
  member: HouseholdMember,
  permissions: RolePermission[],
  key: PermissionKey,
  ownerMemberId?: string | null,
  roles: HouseholdCustomRole[] = DEFAULT_ROLES
): boolean {
  const level = getPermissionLevel(member, permissions, key, roles);
  if (level === 'allowed') return true;
  if (level === 'own_only') return !ownerMemberId || ownerMemberId === member.id;
  return false;
}

export function canDeleteRole(
  roleId: string,
  members: HouseholdMember[],
  roles: HouseholdCustomRole[]
): { success: true } | { success: false; error: string } {
  const role = roles.find(item => item.id === roleId);
  if (!role) return { success: false, error: 'Role not found.' };
  if (members.some(member => getEffectiveRoleId(member) === roleId)) {
    return { success: false, error: 'Cannot delete a role that is assigned to household members.' };
  }
  if (role.is_head_parent && roles.filter(item => item.is_head_parent && item.id !== roleId).length === 0) {
    return { success: false, error: 'At least one Head Parent role must remain.' };
  }
  return { success: true };
}

export function canUpdateRolePermission(input: {
  roleId: string;
  permissionKey: PermissionKey;
  nextLevel: PermissionLevel;
  roles: HouseholdCustomRole[];
  members: HouseholdMember[];
  permissions: RolePermission[];
}): { success: true } | { success: false; error: string } {
  if (input.permissionKey !== 'manage_roles' || input.nextLevel === 'allowed') {
    return { success: true };
  }

  const nextPermissions = input.permissions.map(permission =>
    permission.role_id === input.roleId && permission.permission_key === input.permissionKey
      ? { ...permission, level: input.nextLevel }
      : permission
  );

  const hasRoleManager = input.roles.some(role => {
    if (!role.is_head_parent) return false;
    const assigned = input.members.some(member => getEffectiveRoleId(member) === role.id);
    const level = nextPermissions.find(permission =>
      permission.role_id === role.id && permission.permission_key === 'manage_roles'
    )?.level;
    return assigned && level === 'allowed';
  });

  if (!hasRoleManager) {
    return { success: false, error: 'At least one Head Parent role must keep role management access.' };
  }

  return { success: true };
}
