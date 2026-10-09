'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Home, Plus, LogOut, AlertCircle, X, User, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { supabase } from '../lib/supabase';
import { clearAuthStorage } from '../lib/storageKeys';
import { getCreditCardUsedBalance } from '../lib/creditCardTransactions';
import { ProfileModal } from './ProfileModal';
import { getHouseholdDisplayName } from '../lib/householdNaming';
import { Button } from './ui/Button';
import { MoneyAmount } from './ui/MoneyAmount';
import { desktopBottomNavigationItems, desktopPrimaryNavigationItems, moreNavigationItems, primaryNavigationItems } from './layout/navigation';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenAddTxModal }) => {
  const { currentMember, members, wallets, isAdmin, syncWarning, clearSyncWarning } = useHousehold();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const householdDisplayName = getHouseholdDisplayName(members);
  const visibleWallets = wallets.filter(w => isAdmin || w.is_shared || w.owner_id === currentMember.id);
  const liquidAssets = visibleWallets.filter(w => w.wallet_type !== 'credit_card').reduce((acc, w) => acc + w.current_balance, 0);
  const creditDebt = visibleWallets.filter(w => w.wallet_type === 'credit_card').reduce((acc, w) => acc + getCreditCardUsedBalance(w), 0);
  const totalNetWorth = liquidAssets - creditDebt;

  const navigate = (tab: string) => {
    setActiveTab(tab);
    setShowMore(false);
  };

  useEffect(() => {
    if (!showMore) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowMore(false);
        moreButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showMore]);

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out of FamLedger?')) return;
    try {
      if (supabase) await supabase.auth.signOut();
      clearAuthStorage(window.localStorage);
      window.location.href = '/login';
    } catch {
      clearAuthStorage(window.localStorage);
      window.location.href = '/login';
    }
  };

  const navButton = (item: typeof primaryNavigationItems[number] | typeof moreNavigationItems[number], mobile = false) => {
    const Icon = item.icon;
    const selected = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => navigate(item.id)}
        aria-current={selected ? 'page' : undefined}
        className={mobile
          ? `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors ${selected ? 'bg-brand-sky text-[#16445A]' : 'text-slate-600 hover:bg-slate-100'}`
          : `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${selected ? 'bg-brand-ink text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-brand-ink'}`}
      >
        <Icon className={mobile ? 'h-5 w-5 shrink-0' : 'h-[18px] w-[18px] shrink-0'} aria-hidden="true" />
        <span className={mobile ? 'max-w-full truncate' : ''}>{item.label}</span>
      </button>
    );
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-brand-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <div className="flex h-[4.5rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate('dashboard')} className="flex min-w-0 items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" aria-label="Open FamLedger dashboard">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-brand-ink text-white shadow-sm"><Home className="h-5 w-5" aria-hidden="true" /></span>
            <span className="min-w-0">
              <span className="block text-base font-extrabold tracking-tight text-brand-ink">FamLedger</span>
              <span className="block max-w-[9rem] truncate text-[11px] font-medium text-brand-muted sm:max-w-none">{householdDisplayName}</span>
            </span>
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="max-w-[16rem] text-right leading-tight" title="For visible wallets. Excludes outstanding card service fees and separate loan principal.">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-brand-muted">Liquid balances less used card balances</span>
              <MoneyAmount amount={totalNetWorth} className="text-sm font-bold text-brand-ink" />
            </div>
            <Button tone="primary" size="sm" onClick={onOpenAddTxModal} className="min-h-11"><Plus className="h-4 w-4" aria-hidden="true" />Log transaction</Button>
          </div>

          <div className="relative shrink-0">
            <button type="button" onClick={() => setShowProfileMenu(open => !open)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-line bg-white text-brand-ink transition-colors hover:bg-slate-50" aria-label="Profile menu" aria-expanded={showProfileMenu}>
              <User className="h-5 w-5" aria-hidden="true" />
            </button>
            {showProfileMenu && (
              <div className="absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl border border-brand-line bg-white p-1.5 shadow-xl">
                <div className="border-b border-brand-line px-3 py-2.5">
                  <p className="truncate text-sm font-bold text-brand-ink">{currentMember.display_name}</p>
                  <p className="truncate text-xs text-brand-muted">{currentMember.email || 'No email attached'}</p>
                </div>
                <button type="button" onClick={() => { setShowProfileMenu(false); setShowProfileModal(true); }} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-sm font-medium text-brand-ink hover:bg-slate-50">
                  <span className="flex items-center gap-2"><User className="h-4 w-4" />Profile</span><ChevronDown className="h-4 w-4 -rotate-90" />
                </button>
                <button type="button" onClick={() => { setShowProfileMenu(false); handleLogout(); }} className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-rose-800 hover:bg-rose-50"><LogOut className="h-4 w-4" />Sign out</button>
              </div>
            )}
          </div>
        </div>
        {syncWarning && (
          <div className="mx-4 mb-3 flex items-start justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 sm:mx-6 lg:mx-8" role="status">
            <span className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{syncWarning}</span>
            <button type="button" onClick={clearSyncWarning} className="rounded-lg p-1 hover:bg-amber-100" aria-label="Dismiss sync warning"><X className="h-4 w-4" /></button>
          </div>
        )}
      </header>

      <aside className="fixed bottom-0 left-0 top-[4.5rem] z-30 hidden w-64 border-r border-brand-line bg-[#F1F3F5] px-4 py-5 lg:block">
        <nav aria-label="Main navigation" className="flex h-full flex-col">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.14em] text-brand-muted">Household</p>
          <div className="space-y-1">{desktopPrimaryNavigationItems.map(item => navButton(item))}</div>
          <div className="mt-auto">
            <div className="space-y-1 pt-7">{desktopBottomNavigationItems.map(item => navButton(item))}</div>
          </div>
          <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-brand-line">
            <p className="text-[11px] font-semibold leading-snug text-brand-muted">For visible wallets. Excludes outstanding card service fees and separate loan principal.</p>
            <MoneyAmount amount={totalNetWorth} className="mt-2 block text-sm font-bold text-brand-ink" />
          </div>
        </nav>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 border-t border-brand-line bg-white/95 px-2 pt-1.5 shadow-[0_-8px_24px_rgb(22_38_61/0.06)] backdrop-blur lg:hidden" style={{ paddingBottom: 'max(.375rem, env(safe-area-inset-bottom))' }} aria-label="Mobile navigation">
        {primaryNavigationItems.map(item => navButton(item, true))}
        <button ref={moreButtonRef} type="button" onClick={() => setShowMore(open => !open)} aria-expanded={showMore} aria-controls="more-destinations" className={`flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold ${showMore || moreNavigationItems.some(item => item.id === activeTab) ? 'bg-brand-sky text-[#16445A]' : 'text-slate-600 hover:bg-slate-100'}`}>
          <MoreHorizontal className="h-5 w-5" aria-hidden="true" /><span>More</span>
        </button>
      </nav>

      {showMore && (
        <>
          <button type="button" className="fixed inset-0 z-40 bg-brand-ink/30 lg:hidden" aria-label="Close more navigation" onClick={() => setShowMore(false)} />
          <nav id="more-destinations" aria-label="More destinations" className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 grid grid-cols-2 gap-2 rounded-2xl border border-brand-line bg-white p-3 shadow-2xl lg:hidden">
            {moreNavigationItems.map(item => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => navigate(item.id)} className={`flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${activeTab === item.id ? 'bg-brand-ink text-white' : 'text-brand-ink hover:bg-slate-50'}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span>{item.label}</span></button>;
            })}
          </nav>
        </>
      )}

      <button type="button" onClick={onOpenAddTxModal} className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand-orange px-5 text-sm font-bold text-white shadow-lg transition-transform active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2 lg:hidden" aria-label="Log transaction">
        <Plus className="h-5 w-5" aria-hidden="true" /><span>Log entry</span>
      </button>

      <ProfileModal isOpen={showProfileModal} onClose={() => setShowProfileModal(false)} />
    </>
  );
};
