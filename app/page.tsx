'use client';

import React, { useState } from 'react';
import { Navbar } from '../src/components/Navbar';
import { DashboardView } from '../src/components/DashboardView';
import { WalletsView } from '../src/components/WalletsView';
import { TransactionsView } from '../src/components/TransactionsView';
import { BudgetsView } from '../src/components/BudgetsView';
import { SavingsGoalsView } from '../src/components/SavingsGoalsView';
import { MembersView } from '../src/components/MembersView';

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [showAddTxModal, setShowAddTxModal] = useState<boolean>(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 text-slate-100">
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onOpenAddTxModal={() => setShowAddTxModal(true)} 
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView 
            setActiveTab={setActiveTab} 
            onOpenAddTxModal={() => setShowAddTxModal(true)} 
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
        {activeTab === 'goals' && <SavingsGoalsView />}
        {activeTab === 'members' && <MembersView />}
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        <p>SMCLedger • Multi-Tenant Family Financial Tracker (Next.js MVP 1.0.0)</p>
      </footer>
    </div>
  );
}
