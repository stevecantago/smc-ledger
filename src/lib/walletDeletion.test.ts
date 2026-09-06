import { describe, expect, it } from 'vitest';
import { getWalletDeleteBlocker } from './walletDeletion';
import { Transaction } from '../types/database';

const baseTransaction: Transaction = {
  id: 'tx-1',
  household_id: 'hh-101',
  wallet_id: 'wallet-source',
  destination_wallet_id: null,
  category_id: null,
  payer_id: 'member-admin',
  type: 'expense',
  amount: 100,
  fee: null,
  transaction_date: '2026-09-06',
  note: null,
  receipt_url: null,
  created_at: '2026-09-06T00:00:00.000Z',
};

describe('getWalletDeleteBlocker', () => {
  it('blocks deleting a wallet referenced as a transaction source', () => {
    expect(getWalletDeleteBlocker('wallet-source', [baseTransaction])).toEqual({
      success: false,
      error: 'This wallet has 1 linked transaction. Clear or delete those transactions before deleting the wallet.',
    });
  });

  it('blocks deleting a wallet referenced as a transfer destination', () => {
    expect(getWalletDeleteBlocker('wallet-destination', [{ ...baseTransaction, destination_wallet_id: 'wallet-destination' }]).success).toBe(false);
  });

  it('allows deleting a wallet with no linked transactions', () => {
    expect(getWalletDeleteBlocker('wallet-unused', [baseTransaction])).toEqual({ success: true });
  });
});
