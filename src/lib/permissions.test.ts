import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  canDeleteRole,
  canUpdateRolePermission,
  getEffectiveRoleId,
  hasPermission,
} from './permissions';
import { HouseholdMember, RolePermission } from '../types/database';

const headParent: HouseholdMember = {
  id: 'member-admin',
  household_id: 'hh-101',
  user_id: 'user-admin',
  role: 'admin',
  role_id: 'role-admin-head-parent',
  display_name: 'Head Parent',
  email: 'admin@example.com',
  created_at: '2026-09-06T00:00:00.000Z',
};

const teen: HouseholdMember = {
  id: 'member-teen',
  household_id: 'hh-101',
  user_id: 'user-teen',
  role: 'member',
  role_id: 'role-teen-dependent',
  display_name: 'Teen',
  email: 'teen@example.com',
  created_at: '2026-09-06T00:00:00.000Z',
};

describe('role permissions', () => {
  it('resolves legacy member roles to seeded custom role ids', () => {
    expect(getEffectiveRoleId({ ...headParent, role_id: undefined })).toBe('role-admin-head-parent');
    expect(getEffectiveRoleId({ ...teen, role_id: undefined })).toBe('role-teen-dependent');
  });

  it('allows Head Parent to manage roles even if a matrix row is edited', () => {
    const edited: RolePermission[] = DEFAULT_ROLE_PERMISSIONS.map(permission =>
      permission.role_id === 'role-admin-head-parent' && permission.permission_key === 'manage_roles'
        ? { ...permission, level: 'restricted' }
        : permission
    );

    expect(hasPermission(headParent, edited, 'manage_roles')).toBe(true);
  });

  it('changes access decisions when custom role permissions are edited', () => {
    const blocked: RolePermission[] = DEFAULT_ROLE_PERMISSIONS.map(permission =>
      permission.role_id === 'role-teen-dependent' && permission.permission_key === 'create_transactions'
        ? { ...permission, level: 'restricted' }
        : permission
    );

    expect(hasPermission(teen, DEFAULT_ROLE_PERMISSIONS, 'create_transactions')).toBe(true);
    expect(hasPermission(teen, blocked, 'create_transactions')).toBe(false);
  });

  it('does not allow an assigned custom role to be deleted', () => {
    expect(canDeleteRole('role-teen-dependent', [headParent, teen], DEFAULT_ROLES)).toEqual({
      success: false,
      error: 'Cannot delete a role that is assigned to household members.',
    });
  });

  it('does not allow the final Head Parent role to lose role management access', () => {
    expect(canUpdateRolePermission({
      roleId: 'role-admin-head-parent',
      permissionKey: 'manage_roles',
      nextLevel: 'restricted',
      roles: DEFAULT_ROLES,
      members: [headParent, teen],
      permissions: DEFAULT_ROLE_PERMISSIONS,
    })).toEqual({
      success: false,
      error: 'At least one Head Parent role must keep role management access.',
    });
  });
});
