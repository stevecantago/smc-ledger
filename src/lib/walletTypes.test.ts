import { describe, expect, it } from 'vitest';
import { getWalletTypeLabel, getWalletTypeSummary } from './walletTypes';
import { Wallet } from '../types/database';

const baseWallet: Wallet = {
  id: 'wallet-1',
  household_id: 'hh-101',
  owner_id: 'member-admin',
  name: 'Test Wallet',
  wallet_type: 'e_wallet_savings',
  is_shared: true,
  current_balance: 1250,
  credit_limit: null,
  created_at: '2026-09-07T00:00:00.000Z',
};

describe('wallet types', () => {
  it('labels e-wallet savings as its own account type', () => {
    expect(getWalletTypeLabel('e_wallet_savings')).toBe('E Wallet (Savings)');
  });

  it('summarizes e-wallet savings separately from regular e-wallets', () => {
    const summary = getWalletTypeSummary([
      { ...baseWallet, id: 'wallet-ewallet', wallet_type: 'e_wallet', current_balance: 500 },
      baseWallet,
      { ...baseWallet, id: 'wallet-bank', wallet_type: 'bank', current_balance: 3000 },
    ]);

    expect(summary.eWalletBalance).toBe(500);
    expect(summary.eWalletSavingsBalance).toBe(1250);
    expect(summary.bankBalance).toBe(3000);
  });
});
