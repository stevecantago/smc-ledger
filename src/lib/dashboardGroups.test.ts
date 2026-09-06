import { describe, expect, it } from 'vitest';
import { buildDashboardSummaryColumns, buildDashboardWalletGroups, buildScheduleWalletGroups } from './dashboardGroups';
import { RecurringTransfer, Wallet } from '../types/database';

const baseWallet: Wallet = {
  id: 'wallet-bank',
  household_id: 'hh-101',
  owner_id: 'member-admin',
  name: 'Metrobank Debit',
  wallet_type: 'bank',
  is_shared: true,
  current_balance: 9864.15,
  credit_limit: null,
  created_at: '2026-09-07T00:00:00.000Z',
};

const baseRule: RecurringTransfer = {
  id: 'rule-1',
  household_id: 'hh-101',
  rule_type: 'transfer',
  source_wallet_id: 'wallet-bank',
  destination_wallet_id: 'wallet-ewallet',
  category_id: null,
  loan_id: null,
  amount: 1200,
  frequency: 'weekly',
  next_run_date: '2026-09-13',
  note: 'Weekly Allowance',
  is_active: true,
  created_at: '2026-09-07T00:00:00.000Z',
};

describe('dashboard groups', () => {
  it('builds expandable wallet summary groups with the matching accounts and balances', () => {
    const groups = buildDashboardWalletGroups([
      baseWallet,
      { ...baseWallet, id: 'wallet-ewallet', name: 'Maya Wallet', wallet_type: 'e_wallet', current_balance: 169.4 },
      { ...baseWallet, id: 'wallet-savings', name: 'GoTyme GoSave', wallet_type: 'e_wallet_savings', current_balance: 206.42 },
      { ...baseWallet, id: 'wallet-cash', name: 'Cash Box', wallet_type: 'cash', current_balance: 1500 },
      { ...baseWallet, id: 'wallet-card', name: 'Maya Credit', wallet_type: 'credit_card', current_balance: 7000, credit_limit: 17000 },
    ]);

    expect(groups.map(group => [group.id, group.accounts.length])).toEqual([
      ['bank', 1],
      ['e_wallet', 1],
      ['e_wallet_savings', 1],
      ['cash', 1],
      ['credit_card', 1],
    ]);
    expect(groups.find(group => group.id === 'credit_card')?.accounts[0]).toMatchObject({
      name: 'Maya Credit',
      balance: 10000,
      secondaryBalance: 7000,
    });
  });

  it('omits child cash wallets from the dashboard cash summary group', () => {
    const groups = buildDashboardWalletGroups([
      { ...baseWallet, id: 'cash-maki', name: 'Cash - Maki', wallet_type: 'cash', current_balance: 0 },
      { ...baseWallet, id: 'cash-matti', name: 'Cash - Matti', wallet_type: 'cash', current_balance: 0 },
      { ...baseWallet, id: 'cash-maciej', name: 'Cash - Maciej', wallet_type: 'cash', current_balance: 0 },
      { ...baseWallet, id: 'cash-family', name: 'Family Petty Cash', wallet_type: 'cash', current_balance: 1500 },
      { ...baseWallet, id: 'cash-steve', name: 'Cash - Steve', wallet_type: 'cash', current_balance: 2570 },
    ]);

    expect(groups.find(group => group.id === 'cash')?.accounts).toEqual([
      {
        id: 'cash-family',
        name: 'Family Petty Cash',
        typeLabel: 'Physical Cash',
        isShared: true,
        balance: 1500,
      },
      {
        id: 'cash-steve',
        name: 'Cash - Steve',
        typeLabel: 'Physical Cash',
        isShared: true,
        balance: 2570,
      },
    ]);
  });

  it('builds paying wallet schedule groups with account availability and scheduled items', () => {
    const walletGroups = buildScheduleWalletGroups(
      [
        baseRule,
        { ...baseRule, id: 'rule-2', amount: 250, note: 'Prime Video', rule_type: 'expense' },
      ],
      [
        baseWallet,
        { ...baseWallet, id: 'wallet-ewallet', name: 'Maya Wallet', wallet_type: 'e_wallet', current_balance: 169.4 },
      ],
    );

    expect(walletGroups).toHaveLength(1);
    expect(walletGroups[0]).toMatchObject({
      wallet: baseWallet,
      totalOutflow: 1450,
      availableBalance: 9864.15,
      hasSufficientFunds: true,
    });
    expect(walletGroups[0].items.map(item => item.note)).toEqual(['Weekly Allowance', 'Prime Video']);
  });

  it('keeps dashboard summary cards in the requested two-column order', () => {
    expect(buildDashboardSummaryColumns()).toEqual({
      left: ['total_purchasing_power', 'bank', 'credit_card'],
      right: ['cash', 'e_wallet', 'e_wallet_savings'],
    });
  });
});
