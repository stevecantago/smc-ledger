'use client';

import React from 'react';
import { Navbar } from '../Navbar';

type AppShellProps = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAddTxModal: () => void;
  children: React.ReactNode;
  legacy?: boolean;
};

export function AppShell({ activeTab, setActiveTab, onOpenAddTxModal, children, legacy = false }: AppShellProps) {
  return (
    <div className="min-h-screen bg-brand-canvas">
      <a href="#main-content" className="sr-only z-[100] rounded-lg bg-white px-4 py-3 font-semibold text-brand-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-brand-orange">Skip to main content</a>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} onOpenAddTxModal={onOpenAddTxModal} />
      <div className="lg:ml-64">
        <main id="main-content" tabIndex={-1} className={`${legacy ? 'legacy-view' : 'famledger-main'} mx-auto w-full max-w-[1600px] px-3 py-5 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-7 lg:px-8 lg:pb-8`}>
          {children}
        </main>
        <footer className="border-t border-brand-line px-4 py-5 text-center text-xs text-brand-muted lg:px-8">
          <p>FamLedger · Household finance ledger</p>
        </footer>
      </div>
    </div>
  );
}
