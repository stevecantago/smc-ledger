'use client';

import React, { useState } from 'react';
import { Copy, Plus, Shield, Trash2 } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { HouseholdRole, PermissionKey, PermissionLevel } from '../types/database';
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../lib/permissions';
import { getHouseholdRoleName } from '../lib/permissions';

const permissionLevels: { value: PermissionLevel; label: string }[] = [
  { value: 'allowed', label: 'Allowed' },
  { value: 'own_only', label: 'Own Only' },
  { value: 'read_only', label: 'Read Only' },
  { value: 'restricted', label: 'Restricted' },
];

const baseRoleLabels: Record<HouseholdRole, string> = {
  admin: 'Owner',
  parent_member: 'Admin',
  member: 'Member',
};

export const RolePermissionsMatrix: React.FC = () => {
  const {
    customRoles,
    rolePermissions,
    isHeadParent,
    hasPermission,
    addCustomRole,
    updateCustomRole,
    duplicateCustomRole,
    deleteCustomRole,
    updateRolePermission,
  } = useHousehold();

  const [newRoleName, setNewRoleName] = useState('');
  const [newBaseRole, setNewBaseRole] = useState<HouseholdRole>('member');
  const [message, setMessage] = useState('');
  const canManageRoles = hasPermission('manage_roles');

  const getPermissionLevel = (roleId: string, permissionKey: PermissionKey): PermissionLevel => {
    return rolePermissions.find(permission =>
      permission.role_id === roleId && permission.permission_key === permissionKey
    )?.level || 'restricted';
  };

  const handleResult = (result: { success: boolean; error?: string }, successMessage: string) => {
    setMessage(result.success ? successMessage : (result.error || 'Permission update failed.'));
  };

  const handleCreateRole = (event: React.FormEvent) => {
    event.preventDefault();
    const result = addCustomRole({ name: newRoleName, base_role: newBaseRole });
    if (result.success) {
      setNewRoleName('');
      setNewBaseRole('member');
    }
    handleResult(result, 'Role created.');
  };

  return (
    <section aria-labelledby="role-permissions-heading" className="space-y-4 rounded-2xl border border-brand-line bg-brand-paper p-4 shadow-[var(--fam-shadow)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="role-permissions-heading" className="flex items-center gap-2 text-base font-bold text-brand-ink">
            <Shield className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            <span>Role Permissions Matrix</span>
          </h3>
          <p className="mt-1 text-sm text-brand-muted">Set access for the Owner, Admin, and Member roles. Family relationships are managed on each member profile.</p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-brand-sky bg-[#EAF6F9] p-3 text-sm text-brand-ink" role="status">
          {message}
        </div>
      )}

      {isHeadParent && canManageRoles && (
        <form onSubmit={handleCreateRole} className="grid grid-cols-1 gap-2 rounded-xl border border-brand-line bg-brand-canvas p-3 md:grid-cols-[1fr_180px_auto]">
          <input
            value={newRoleName}
            onChange={event => setNewRoleName(event.target.value)}
            placeholder="New custom role name"
            className="min-h-11 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
          />
          <select value={newBaseRole} onChange={event => setNewBaseRole(event.target.value as HouseholdRole)} className="min-h-11 rounded-lg border border-brand-line bg-white px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
            <option value="member">Member base</option>
            <option value="parent_member">Admin base</option>
            <option value="admin">Owner base</option>
          </select>
          <button type="submit" className="flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-brand-orange px-3 py-2 text-sm font-bold text-white hover:bg-[#AB4311] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create Role</span>
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-brand-line bg-brand-canvas text-[11px] font-bold uppercase tracking-wider text-brand-muted">
              <th scope="col" className="px-3 py-3">Permission scope</th>
              {customRoles.map(role => (
                <th key={role.id} scope="col" className="px-3 py-3 text-center text-brand-ink">
                  {role.is_default ? <span className="mb-1 block text-sm font-bold">{getHouseholdRoleName(role)}</span> : <input
                    value={role.name}
                    disabled={!canManageRoles}
                    onChange={event => handleResult(updateCustomRole(role.id, { name: event.target.value }), 'Role renamed.')}
                    aria-label={`Role name: ${role.name}`}
                    className="mb-1 min-h-9 w-full rounded-lg border border-brand-line bg-white px-2 text-center text-sm font-bold text-brand-ink disabled:border-transparent disabled:bg-transparent"
                  />}
                  <div className="flex items-center justify-center gap-1">
                    <span className="rounded bg-brand-sky px-1.5 py-0.5 text-[10px] font-semibold text-[#16445A]">
                      {baseRoleLabels[role.base_role]} permissions
                    </span>
                    {role.is_head_parent && (
                      <span className="rounded bg-brand-mint px-1.5 py-0.5 text-[10px] text-[#31522A]">Owner</span>
                    )}
                  </div>
                  {canManageRoles && !role.is_default && (
                    <div className="mt-2 flex justify-center gap-1">
                      <button type="button" onClick={() => handleResult(duplicateCustomRole(role.id), 'Role duplicated.')} className="rounded p-1 text-brand-muted hover:bg-brand-sky hover:text-brand-ink" title="Duplicate Role" aria-label={`Duplicate ${role.name}`}>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => handleResult(deleteCustomRole(role.id), 'Role deleted.')} className="rounded p-1 text-brand-muted hover:bg-rose-50 hover:text-rose-800" title="Delete Role" aria-label={`Delete ${role.name}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-line text-brand-ink">
            {PERMISSION_KEYS.map(permissionKey => (
              <tr key={permissionKey}>
                <th scope="row" className="px-3 py-3 font-medium text-brand-ink">{PERMISSION_LABELS[permissionKey]}</th>
                {customRoles.map(role => (
                  <td key={`${role.id}-${permissionKey}`} className="px-3 py-2.5 text-center">
                    <select
                      value={role.is_head_parent && permissionKey === 'manage_roles' ? 'allowed' : getPermissionLevel(role.id, permissionKey)}
                      disabled={!canManageRoles || (role.is_head_parent && permissionKey === 'manage_roles')}
                      onChange={event => handleResult(updateRolePermission(role.id, permissionKey, event.target.value as PermissionLevel), 'Permission updated.')}
                      aria-label={`${getHouseholdRoleName(role)} permission: ${PERMISSION_LABELS[permissionKey]}`}
                      className="min-h-10 w-full rounded-lg border border-brand-line bg-white px-2 text-sm font-semibold text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:bg-brand-canvas disabled:text-brand-muted"
                    >
                      {permissionLevels.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
