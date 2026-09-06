'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '../src/components/Navbar';
import { DashboardView } from '../src/components/DashboardView';
import { WalletsView } from '../src/components/WalletsView';
import { TransactionsView } from '../src/components/TransactionsView';
import { BudgetsView } from '../src/components/BudgetsView';
import { LoansView } from '../src/components/LoansView';
import { SavingsGoalsView } from '../src/components/SavingsGoalsView';
import { MembersView } from '../src/components/MembersView';
import { ActivityLogView } from '../src/components/ActivityLogView';
import { supabase } from '../src/lib/supabase';
import { getRootAuthAction } from '../src/lib/authFlow';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  React.useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data: { session } } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };

      const action = getRootAuthAction({
        isSupabaseConfigured: Boolean(supabase),
        hasSession: Boolean(session),
      });

      if (!isMounted) return;

      if (action === 'redirect_login') {
        router.replace('/login');
        return;
      }

      setIsSessionReady(true);
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleOpenAddTxModal = () => {
    setActiveTab('transactions');
    setShowAddTxModal(true);
  };

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-white">Checking secure session...</p>
          <p className="text-xs text-slate-400">Redirecting to sign in when needed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenAddTxModal={handleOpenAddTxModal} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-32 md:pb-8">
        {activeTab === 'dashboard' && (
          <DashboardView 
            setActiveTab={setActiveTab} 
            onOpenAddTxModal={handleOpenAddTxModal} 
          />
        )}
        {activeTab === 'wallets' && <WalletsView />}
        {activeTab === 'transactions' && (
          <TransactionsView 
            showModal={showAddTxModal} 
            setShowModal={setShowAddTxModal} 
          />
        )}
        {activeTab === 'budgets' && <BudgetsView />}
        {activeTab === 'loans' && <LoansView />}
        {activeTab === 'goals' && <SavingsGoalsView />}
        {activeTab === 'members' && <MembersView />}
        {activeTab === 'activity' && <ActivityLogView />}
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500 mb-20 md:mb-0">
        <p>SMCLedger • Multi-Tenant Family Financial Tracker (Next.js MVP 1.0.0)</p>
      </footer>
    </div>
  );
}
