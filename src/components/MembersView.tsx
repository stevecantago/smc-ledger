'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Users, ShieldCheck, UserCheck, Plus, CheckCircle, Clock, AlertTriangle, Edit2, Trash2, Shield, HeartHandshake } from 'lucide-react';
import { HouseholdRole, HouseholdMember } from '../types/database';

export const MembersView: React.FC = () => {
  const { 
    members, currentMember, isAdmin, wallets, transactions, 
    addMember, updateMember, deleteMember 
  } = useHousehold();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);

  // Add Member State
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newRole, setNewRole] = useState<HouseholdRole>('member');
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Member State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<HouseholdRole>('member');

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newDisplayName.trim()) {
      setErrorMsg('Please enter a display name for the member.');
      return;
    }

    addMember(newDisplayName.trim(), newRole);
    setNewDisplayName('');
    setShowAddModal(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!editingMember) return;

    const res = updateMember(editingMember.id, {
      display_name: editDisplayName.trim(),
      role: editRole,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to update member.');
      return;
    }

    setEditingMember(null);
  };

  const handleDeleteMember = (member: HouseholdMember) => {
    if (!window.confirm(`Are you sure you want to remove ${member.display_name} from the household roster?`)) return;
    const res = deleteMember(member.id);
    if (!res.success) {
      alert(res.error);
    }
  };

  const getRoleBadge = (role: HouseholdRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="flex items-center text-xs font-semibold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded border border-amber-400/20">
            <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Admin (Head Parent)
          </span>
        );
      case 'parent_member':
        return (
          <span className="flex items-center text-xs font-semibold text-purple-400 bg-purple-400/10 px-2.5 py-0.5 rounded border border-purple-400/20">
            <HeartHandshake className="w-3.5 h-3.5 mr-1" /> Member (Parent/Guardian)
          </span>
        );
      case 'member':
        return (
          <span className="flex items-center text-xs font-semibold text-sky-400 bg-sky-400/10 px-2.5 py-0.5 rounded border border-sky-400/20">
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Member (Teen/Dependent)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-sky-400" />
            <span>Family Roster & Role Permissions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage household profiles, assign Head Admin vs Member (Parent/Guardian) vs Dependent roles.
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setErrorMsg('');
              setShowAddModal(true);
            }}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Family Member</span>
          </button>
        )}
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {members.map(m => {
          const ownedWallets = wallets.filter(w => w.owner_id === m.id);
          const memberTxCount = transactions.filter(t => t.payer_id === m.id).length;
          const isSelf = currentMember.id === m.id;

          return (
            <div 
              key={m.id} 
              className={`bg-slate-800/90 border rounded-xl p-5 space-y-4 shadow-lg flex flex-col justify-between transition-all ${
                isSelf ? 'border-sky-500/60 ring-1 ring-sky-500/30' : 'border-slate-700/80 hover:border-slate-600'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-700 font-bold text-base text-sky-400 flex items-center justify-center shadow-inner">
                      {m.display_name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
                        <span>{m.display_name}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                            YOU
                          </span>
                        )}
                      </h3>
                      <div className="mt-1">{getRoleBadge(m.role)}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 text-[10px]">Owned Wallets:</span>
                    <p className="font-bold text-white font-mono mt-0.5">{ownedWallets.length} Accounts</p>
                  </div>
                  <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                    <span className="text-slate-400 text-[10px]">Transactions Logged:</span>
                    <p className="font-bold text-emerald-400 font-mono mt-0.5">{memberTxCount} Entries</p>
                  </div>
                </div>
              </div>

              {/* Admin CRUD Action Buttons */}
              {isAdmin && (
                <div className="pt-3 border-t border-slate-700/60 flex items-center justify-end space-x-2">
                  <button
                    onClick={() => {
                      setErrorMsg('');
                      setEditingMember(m);
                      setEditDisplayName(m.display_name);
                      setEditRole(m.role);
                    }}
                    title="Edit Member Profile & Role"
                    className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {!isSelf && (
                    <button
                      onClick={() => handleDeleteMember(m)}
                      title="Remove Member from Roster"
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center space-x-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <span>Role Permissions Matrix</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <th className="py-2.5 px-3">Permission Scope</th>
                <th className="py-2.5 px-3 text-center text-amber-400">Admin (Head Parent)</th>
                <th className="py-2.5 px-3 text-center text-purple-400">Member (Parent/Guardian)</th>
                <th className="py-2.5 px-3 text-center text-sky-400">Member (Teen/Dependent)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-slate-300">
              <tr>
                <td className="py-2.5 px-3 font-medium">Log Expense / Income / Transfer</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium">24-Hour Edit Window on Own Transactions</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Unrestricted</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Unrestricted</td>
                <td className="py-2.5 px-3 text-center text-amber-400 font-medium">24h Limit Enforced</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium">Manage Envelope Budgets & Limits</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-slate-500">Read-Only</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium">Create/Delete Wallets & Credit Lines</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-slate-500 font-medium">Personal Only</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-medium">Family Roster Management (Add/Remove Members)</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-emerald-400 font-bold">Allowed</td>
                <td className="py-2.5 px-3 text-center text-slate-500">Restricted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add New Family Member</h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma Betty, Chloe Miller"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Household Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as HouseholdRole)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="parent_member">Member (Parent/Guardian)</option>
                  <option value="admin">Admin (Head Parent)</option>
                  <option value="member">Member (Teen/Dependent)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-all shadow"
                >
                  Add Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Edit Member: {editingMember.display_name}</h3>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Assigned Household Role</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as HouseholdRole)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="parent_member">Member (Parent/Guardian)</option>
                  <option value="admin">Admin (Head Parent)</option>
                  <option value="member">Member (Teen/Dependent)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition-all shadow"
                >
                  Save Member Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
