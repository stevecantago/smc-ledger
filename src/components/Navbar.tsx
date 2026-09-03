'use client';

import React, { useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import { 
  ShieldCheck, UserCheck, Wallet as WalletIcon, Home, PlusCircle, Users, Landmark, Target, Menu, X 
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAddTxModal }) => {
  const { household, currentMember, members, switchMember, wallets, isAdmin } = useHousehold();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const totalNetWorth = visibleWallets.reduce((acc, w) => acc + w.current_balance, 0);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'wallets', label: 'Wallets', icon: WalletIcon },
    { id: 'transactions', label: 'Ledger', icon: PlusCircle },
    { id: 'budgets', label: 'Envelopes', icon: ShieldCheck },
    { id: 'loans', label: 'Loans', icon: Landmark },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'members', label: 'Roster', icon: Users },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            
            {/* Brand Logo & Household Name */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <Home className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-base sm:text-lg text-white tracking-tight">SMCLedger</span>
                  <span className="hidden xs:inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700">MVP</span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 font-medium truncate max-w-[120px] sm:max-w-none">{household.name}</p>
              </div>
            </div>

            {/* Quick Balance & Add Transaction (Desktop / Tablet) */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center space-x-2">
                <WalletIcon className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-slate-400">Net Worth:</span>
                <span className="font-bold text-sm text-emerald-400">
                  ₱{totalNetWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <button
                onClick={onOpenAddTxModal}
                className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-lg font-medium text-xs transition-all shadow-md active:scale-[0.98]"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Log Tx</span>
              </button>
            </div>

            {/* Persona Switcher & Mobile Menu Toggle */}
            <div className="flex items-center space-x-2">
              <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-1 flex items-center">
                <div className="px-1.5 sm:px-2 py-0.5 flex items-center text-[10px] sm:text-xs font-semibold">
                  {isAdmin ? (
                    <span className="flex items-center text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                      <ShieldCheck className="w-3 h-3 mr-1 shrink-0" /> Admin
                    </span>
                  ) : (
                    <span className="flex items-center text-sky-400 bg-sky-400/10 px-1.5 py-0.5 rounded border border-sky-400/20">
                      <UserCheck className="w-3 h-3 mr-1 shrink-0" /> Member
                    </span>
                  )}
                </div>

                <select
                  value={currentMember.id}
                  onChange={(e) => switchMember(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-[11px] sm:text-xs font-medium border border-slate-700 rounded px-1.5 sm:px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer max-w-[110px] sm:max-w-none truncate"
                  title="Switch Member Persona"
                >
                  {members.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobile Quick Add Tx Icon Button */}
              <button
                onClick={onOpenAddTxModal}
                className="md:hidden p-2 bg-sky-600 active:bg-sky-500 text-white rounded-lg transition-colors shadow"
                title="Log Transaction"
              >
                <PlusCircle className="w-4 h-4" />
              </button>

              {/* Mobile Menu Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 text-slate-400 hover:text-white bg-slate-800 border border-slate-700 rounded-lg transition-colors"
                aria-label="Toggle Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>

          </div>

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

          {/* Mobile Expanded Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="md:hidden py-3 border-t border-slate-800 grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              {navItems.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                        : 'bg-slate-800/80 text-slate-300 border border-slate-700/60 active:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-sky-400" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Mobile Bottom Fixed Dock Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 py-1.5 px-2 flex items-center justify-around shadow-2xl">
        {navItems.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors ${
                isActive ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400 scale-110' : 'text-slate-400'}`} />
              <span className="text-[10px] font-medium mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
