'use client';

import React, { useState } from 'react';
import { Copy, Plus, Shield, Trash2 } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { HouseholdRole, PermissionKey, PermissionLevel } from '../types/database';
import { PERMISSION_KEYS, PERMISSION_LABELS } from '../lib/permissions';

const permissionLevels: { value: PermissionLevel; label: string }[] = [
  { value: 'allowed', label: 'Allowed' },
  { value: 'own_only', label: 'Own Only' },
  { value: 'read_only', label: 'Read Only' },
  { value: 'restricted', label: 'Restricted' },
];

const baseRoleLabels: Record<HouseholdRole, string> = {
  admin: 'Admin',
  parent_member: 'Parent/Guardian',
  member: 'Teen/Dependent',
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
    <div className="space-y-4 rounded-xl border border-slate-700/70 bg-slate-800/80 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center space-x-2 text-sm font-bold text-white">
            <Shield className="h-4 w-4 text-amber-400" />
            <span>Role Permissions Matrix</span>
          </h3>
          <p className="mt-1 text-xs text-slate-400">Custom roles use fixed permission scopes so access can be enforced across the app.</p>
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-xs text-sky-200">
          {message}
        </div>
      )}

      {isHeadParent && canManageRoles && (
        <form onSubmit={handleCreateRole} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-700/70 bg-slate-900/60 p-3 md:grid-cols-[1fr_180px_auto]">
          <input
            value={newRoleName}
            onChange={event => setNewRoleName(event.target.value)}
            placeholder="New custom role name"
            className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white"
          />
          <select value={newBaseRole} onChange={event => setNewBaseRole(event.target.value as HouseholdRole)} className="rounded-lg border border-slate-700 bg-slate-800 p-2.5 text-xs text-white">
            <option value="member">Teen/Dependent base</option>
            <option value="parent_member">Parent/Guardian base</option>
            <option value="admin">Head Parent base</option>
          </select>
          <button type="submit" className="flex items-center justify-center space-x-1.5 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400">
            <Plus className="h-4 w-4" />
            <span>Create Role</span>
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700 bg-slate-900/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <th className="px-3 py-2.5">Permission Scope</th>
              {customRoles.map(role => (
                <th key={role.id} className="px-3 py-2.5 text-center text-slate-200">
                  <input
                    value={role.name}
                    disabled={!canManageRoles}
                    onChange={event => handleResult(updateCustomRole(role.id, { name: event.target.value }), 'Role renamed.')}
                    className="mb-1 w-full rounded border border-slate-700 bg-slate-800 p-1.5 text-center text-xs font-bold text-white disabled:border-transparent disabled:bg-transparent"
                  />
                  <div className="flex items-center justify-center gap-1">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {baseRoleLabels[role.base_role]}
                    </span>
                    {role.is_head_parent && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">Head Parent</span>
                    )}
                  </div>
                  {canManageRoles && !role.is_default && (
                    <div className="mt-2 flex justify-center gap-1">
                      <button type="button" onClick={() => handleResult(duplicateCustomRole(role.id), 'Role duplicated.')} className="rounded p-1 text-slate-400 hover:bg-sky-500/10 hover:text-sky-300" title="Duplicate Role">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => handleResult(deleteCustomRole(role.id), 'Role deleted.')} className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300" title="Delete Role">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/60 text-slate-300">
            {PERMISSION_KEYS.map(permissionKey => (
              <tr key={permissionKey}>
                <td className="px-3 py-2.5 font-medium">{PERMISSION_LABELS[permissionKey]}</td>
                {customRoles.map(role => (
                  <td key={`${role.id}-${permissionKey}`} className="px-3 py-2.5 text-center">
                    <select
                      value={role.is_head_parent && permissionKey === 'manage_roles' ? 'allowed' : getPermissionLevel(role.id, permissionKey)}
                      disabled={!canManageRoles || (role.is_head_parent && permissionKey === 'manage_roles')}
                      onChange={event => handleResult(updateRolePermission(role.id, permissionKey, event.target.value as PermissionLevel), 'Permission updated.')}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs font-semibold text-slate-100 disabled:opacity-70"
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
    </div>
  );
};
