'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  ShieldCheck, Wallet as WalletIcon, Home, PlusCircle, Users, Landmark, Target, Plus, LogOut, History, AlertCircle, X, Clock, User, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { clearAuthStorage } from '../lib/storageKeys';
import { getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { ProfileModal } from './ProfileModal';
import { getHouseholdDisplayName } from '../lib/householdNaming';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAddTxModal }) => {
  const { currentMember, members, wallets, isAdmin, syncWarning, clearSyncWarning } = useHousehold();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const householdDisplayName = getHouseholdDisplayName(members);

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const liquidAssets = visibleWallets
    .filter(w => w.wallet_type !== 'credit_card')
    .reduce((acc, w) => acc + w.current_balance, 0);
  const creditDebt = visibleWallets
    .filter(w => w.wallet_type === 'credit_card')
    .reduce((acc, w) => acc + getCreditCardUsedBalance(w), 0);

  const totalNetWorth = liquidAssets - creditDebt;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'transactions', label: 'Ledger', icon: PlusCircle },
    { id: 'budgets', label: 'Envelopes', icon: ShieldCheck },
    { id: 'loans', label: 'Loans', icon: Landmark },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'members', label: 'Roster', icon: Users },
    { id: 'activity', label: 'Activity Log', icon: History },
  ];

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out of FamLedger?')) return;
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      if (typeof window !== 'undefined') {
        clearAuthStorage(window.localStorage);
        window.location.href = '/login';
      }
    } catch (err) {
      if (typeof window !== 'undefined') {
        clearAuthStorage(window.localStorage);
        window.location.href = '/login';
      }
    }
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            
            {/* Brand Logo & Household Name */}
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="flex shrink-0 items-center space-x-2 rounded-xl text-left transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-sky-500/60 sm:space-x-3"
              aria-label="Open dashboard"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1">
                  <span className="font-bold text-base sm:text-lg text-white tracking-tight">FamLedger</span>
                  <span className="hidden xs:inline-block text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">MVP</span>
                </div>
                <p className="text-[10px] sm:text-xs text-slate-400 font-medium truncate max-w-[110px] xs:max-w-[150px] sm:max-w-none">{householdDisplayName}</p>
              </div>
            </button>

            {/* Quick Balance & Add Transaction (Desktop / Tablet) */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
                <WalletIcon className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-slate-400">Net Assets:</span>
                <span className="font-bold text-sm text-emerald-400">
                  ₱{totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                onClick={onOpenAddTxModal}
                className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow-md active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Log Transaction</span>
              </button>
            </div>

            {/* Profile Menu */}
            <div className="relative shrink-0">
              <button
                onClick={() => setShowProfileMenu(open => !open)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-slate-300 transition-colors hover:border-sky-500/40 hover:bg-slate-700 hover:text-white"
                title="Profile menu"
                aria-label="Profile menu"
                aria-expanded={showProfileMenu}
              >
                <User className="h-4 w-4" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
                  <div className="border-b border-slate-800 px-3 py-2">
                    <p className="truncate text-xs font-bold text-white">{currentMember.display_name}</p>
                    <p className="truncate text-[10px] text-slate-400">{currentMember.email || 'No email attached'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowProfileModal(true);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-sky-400" />
                      Profile
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-slate-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-semibold text-rose-300 hover:bg-rose-500/10"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>

          {syncWarning && (
            <div className="mb-2 flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
                <span>{syncWarning}</span>
              </div>
              <button
                type="button"
                onClick={clearSyncWarning}
                className="rounded p-1 text-amber-200 hover:bg-amber-500/15 hover:text-white"
                aria-label="Dismiss sync warning"
                title="Dismiss sync warning"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Desktop Navigation Tabs (Horizontal Bar) */}
          <div className="hidden md:flex items-center space-x-1 border-t border-slate-800 overflow-x-auto py-2 scrollbar-none">
            {navItems.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
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

      {/* Mobile Fixed Bottom Dock Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-1.5 px-2 flex items-center justify-around shadow-2xl">
        {navItems.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400 scale-110' : 'text-slate-400'}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile Floating Action Button (FAB) for Instant 1-Tap Log Transaction */}
      <button
        onClick={onOpenAddTxModal}
        className="md:hidden fixed bottom-16 right-4 z-50 bg-gradient-to-tr from-sky-600 to-indigo-600 active:from-sky-500 active:to-indigo-500 text-white rounded-full p-3.5 shadow-2xl border border-sky-400/40 flex items-center justify-center ring-4 ring-sky-500/20 active:scale-95 transition-all"
        title="Log Transaction"
        aria-label="Log Transaction"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </>
  );
};
