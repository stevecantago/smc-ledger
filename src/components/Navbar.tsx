'use client';

import React from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, UserCheck, Wallet as WalletIcon, Home, PlusCircle, Users } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAddTxModal }) => {
  const { household, currentMember, members, switchMember, wallets, isAdmin } = useHousehold();

  // Visible wallets filter based on RLS (Admin sees all; Member sees shared + owned)
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const totalNetWorth = visibleWallets.reduce((acc, w) => acc + w.current_balance, 0);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand Logo & Household Name */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Home className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-white tracking-tight">SMCLedger</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono border border-slate-700">Next.js MVP</span>
              </div>
              <p className="text-xs text-slate-400 font-medium">{household.name}</p>
            </div>
          </div>

          {/* Quick Balance & Add Transaction */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="px-3.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
              <WalletIcon className="w-4 h-4 text-sky-400" />
              <span className="text-xs text-slate-400">Total Net Worth:</span>
              <span className="font-bold text-sm text-emerald-400">
                ${totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <button
              onClick={onOpenAddTxModal}
              className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-md shadow-sky-600/20 hover:shadow-sky-500/30 active:scale-[0.98]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Transaction</span>
            </button>
          </div>

          {/* Role & Persona Switcher */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-1 flex items-center">
              <div className="px-2 py-1 flex items-center space-x-1.5 text-xs font-semibold">
                {isAdmin ? (
                  <span className="flex items-center text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Admin
                  </span>
                ) : (
                  <span className="flex items-center text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded border border-sky-400/20">
                    <UserCheck className="w-3.5 h-3.5 mr-1" /> Member
                  </span>
                )}
              </div>

              <select
                value={currentMember.id}
                onChange={(e) => switchMember(e.target.value)}
                className="bg-slate-900 text-slate-200 text-xs font-medium border border-slate-700 rounded px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
                title="Switch Member Persona to test RBAC roles"
              >
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} ({m.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 border-t border-slate-800 overflow-x-auto py-2 scrollbar-none">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'wallets', label: 'Wallets & Accounts', icon: WalletIcon },
            { id: 'transactions', label: 'Transactions Ledger', icon: PlusCircle },
            { id: 'budgets', label: 'Envelope Budgets', icon: ShieldCheck },
            { id: 'goals', label: 'Savings Goals', icon: UserCheck },
            { id: 'members', label: 'Family Roster (RBAC)', icon: Users },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
