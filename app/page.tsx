'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../src/components/layout/AppShell';
import { DashboardView } from '../src/components/DashboardView';
import { WalletsView } from '../src/components/WalletsView';
import { TransactionsView } from '../src/components/TransactionsView';
import { LoansView } from '../src/components/LoansView';
import { SavingsGoalsView } from '../src/components/SavingsGoalsView';
import { ActivityLogView } from '../src/components/ActivityLogView';
import { SchedulesView } from '../src/components/SchedulesView';
import { SettingsView } from '../src/components/SettingsView';
import { supabase } from '../src/lib/supabase';
import { getRootAuthAction } from '../src/lib/authFlow';
import { TransactionType } from '../src/types/database';

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);
  const [transactionDraft, setTransactionDraft] = useState<{
    type?: TransactionType;
    walletId?: string;
    destinationWalletId?: string;
    amount?: number;
    note?: string;
    requireSourceSelection?: boolean;
    creditCardPayment?: boolean;
    categoryId?: string;
    selectedRecurringId?: string;
    selectedLoanId?: string;
    transactionDate?: string;
  } | null>(null);
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
        if (typeof window !== 'undefined') {
          window.location.replace('/login');
        }
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
    setTransactionDraft(null);
    setActiveTab('transactions');
    setShowAddTxModal(true);
  };

  const handleLogCardExpense = (walletId: string) => {
    setTransactionDraft({ type: 'expense', walletId });
    setActiveTab('transactions');
    setShowAddTxModal(true);
  };

  const handlePayCreditCard = (walletId: string, amount: number, walletName: string) => {
    setTransactionDraft({
      type: 'loan',
      walletId: '',
      destinationWalletId: walletId,
      amount,
      note: `Credit card payment - ${walletName}`,
      requireSourceSelection: true,
      creditCardPayment: true,
    });
    setActiveTab('transactions');
    setShowAddTxModal(true);
  };

  const handleLogScheduledTransaction = (draft: {
    type: TransactionType;
    walletId?: string;
    destinationWalletId?: string;
    amount?: number;
    note?: string;
    categoryId?: string;
    selectedRecurringId?: string;
    selectedLoanId?: string;
    transactionDate?: string;
  }) => {
    setTransactionDraft(draft);
    setActiveTab('transactions');
    setShowAddTxModal(true);
  };

  if (!isSessionReady) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold text-brand-ink">Checking secure session...</p>
          <p className="text-xs text-brand-muted">Redirecting to sign in when needed.</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell activeTab={activeTab} setActiveTab={setActiveTab} onOpenAddTxModal={handleOpenAddTxModal} legacy={!['dashboard', 'wallets', 'transactions', 'goals', 'loans', 'activity', 'settings'].includes(activeTab)}>
        {activeTab === 'dashboard' && (
          <DashboardView 
            setActiveTab={setActiveTab} 
            onOpenAddTxModal={handleOpenAddTxModal} 
            onPayCreditCard={handlePayCreditCard}
          />
        )}
        {activeTab === 'wallets' && <WalletsView onLogCardExpense={handleLogCardExpense} />}
        {activeTab === 'transactions' && (
          <TransactionsView 
            showModal={showAddTxModal} 
            setShowModal={setShowAddTxModal} 
            draft={transactionDraft}
          />
        )}
        {activeTab === 'loans' && <LoansView />}
        {activeTab === 'schedules' && <SchedulesView onPayCreditCard={handlePayCreditCard} onLogTransaction={handleLogScheduledTransaction} />}
        {activeTab === 'goals' && <SavingsGoalsView />}
        {activeTab === 'activity' && <ActivityLogView />}
        {activeTab === 'settings' && <SettingsView />}
    </AppShell>
  );
}
