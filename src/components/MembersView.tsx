'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { Users, ShieldCheck, UserCheck, Plus, Check, X, ShieldAlert } from 'lucide-react';
import { HouseholdRole } from '../types/database';

export const MembersView: React.FC = () => {
  const { members, currentMember, isAdmin, addMember } = useHousehold();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<HouseholdRole>('member');

  const handleInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    addMember(displayName.trim(), role);
    setDisplayName('');
    setShowInviteModal(false);
  };

  const matrix = [
    { capability: 'Initialize household & invite users', admin: true, member: false },
    { capability: 'Change member roles / remove members', admin: true, member: false },
    { capability: 'Create, edit, delete shared categories', admin: true, member: false },
    { capability: 'Set monthly envelope budget limits', admin: true, member: false },
    { capability: 'Create shared or private wallets', admin: 'Shared & Personal', member: 'Personal only' },
    { capability: 'Log income, expense, and transfer', admin: true, member: true },
    { capability: 'Edit/delete own transactions', admin: 'Unlimited', member: 'Within 24 hrs' },
    { capability: 'Edit/delete any member\'s transaction', admin: true, member: false },
    { capability: 'Create & fund savings goals', admin: 'Create & Fund', member: 'Read & Fund' },
    { capability: 'View aggregated household analytics', admin: 'Full Analytics', member: 'High-level only' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-800/80 border border-slate-700/70 p-5 rounded-xl">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-sky-400" />
            <span>Household Family Roster & RBAC Permissions</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage multi-tenant household memberships and review active Row-Level Security guardrails.
          </p>
        </div>

        {isAdmin ? (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-xs transition-all shadow"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Household Member</span>
          </button>
        ) : (
          <div className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
            Read-only mode (Admin manages family roster)
          </div>
        )}
      </div>

      {/* Active Household Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {members.map(m => (
          <div 
            key={m.id} 
            className={`bg-slate-800/90 border rounded-xl p-5 space-y-3 transition-all ${
              m.id === currentMember.id 
                ? 'border-sky-500/60 ring-1 ring-sky-500/30' 
                : 'border-slate-700/80 hover:border-slate-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center font-bold text-white text-sm border border-slate-600">
                  {m.display_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white flex items-center space-x-1.5">
                    <span>{m.display_name}</span>
                    {m.id === currentMember.id && (
                      <span className="text-[10px] bg-sky-400/20 text-sky-300 px-1.5 py-0.2 rounded font-medium">You</span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">ID: {m.id.substring(0, 15)}...</p>
                </div>
              </div>

              {m.role === 'admin' ? (
                <span className="flex items-center text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                </span>
              ) : (
                <span className="flex items-center text-[10px] font-semibold text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">
                  <UserCheck className="w-3 h-3 mr-1" /> Member
                </span>
              )}
            </div>

            <p className="text-xs text-slate-400 pt-2 border-t border-slate-700/60">
              Joined: <span className="text-slate-300 font-medium">{new Date(m.created_at).toLocaleDateString()}</span>
            </p>
          </div>
        ))}
      </div>

      {/* PRD Role & Permission Matrix (RBAC) */}
      <div className="bg-slate-800/80 border border-slate-700/70 rounded-xl p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white">System Permission Matrix (RBAC / RLS Enforcement)</h3>
          <p className="text-xs text-slate-400">Strict database level policy enforcement based on PRD specifications</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-700">
                <th className="py-3 px-4">Capability / Action</th>
                <th className="py-3 px-4 text-center">Admin (Parent / Guardian)</th>
                <th className="py-3 px-4 text-center">Member (Dependent / Teen)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {matrix.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-700/20">
                  <td className="py-3 px-4 font-medium text-slate-200">{row.capability}</td>
                  
                  {/* Admin Cell */}
                  <td className="py-3 px-4 text-center">
                    {typeof row.admin === 'boolean' ? (
                      row.admin ? (
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Check className="w-4 h-4 mr-1" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-500">
                          <X className="w-4 h-4 mr-1" /> No
                        </span>
                      )
                    ) : (
                      <span className="text-amber-400 font-semibold">{row.admin}</span>
                    )}
                  </td>

                  {/* Member Cell */}
                  <td className="py-3 px-4 text-center">
                    {typeof row.member === 'boolean' ? (
                      row.member ? (
                        <span className="inline-flex items-center text-emerald-400 font-semibold">
                          <Check className="w-4 h-4 mr-1" /> Yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-rose-400 font-semibold">
                          <X className="w-4 h-4 mr-1" /> No
                        </span>
                      )
                    ) : (
                      <span className="text-sky-400 font-semibold">{row.member}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <h3 className="text-base font-bold text-white">Add Household Member</h3>

            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jordan Miller, Grandma Betty"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Household Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as HouseholdRole)}
                  className="w-full bg-slate-800 text-white text-xs border border-slate-700 rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="member">Member (Dependent / Teen)</option>
                  <option value="admin">Admin (Parent / Guardian)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
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
    </div>
  );
};
