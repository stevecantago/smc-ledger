import { describe, expect, it } from 'vitest';
import type { Category, HouseholdMember, Transaction, Wallet } from '../types/database';
import { buildTransactionsCsv } from './exportCsv';

const wallets = [
  {
    id: 'bank-1',
    household_id: 'hh-1',
    owner_id: 'member-1',
    name: 'Bank',
    wallet_type: 'bank',
    is_shared: true,
    current_balance: 50000,
    credit_limit: null,
    service_fee_balance: 0,
    created_at: '2026-10-03T00:00:00.000Z',
  },
  {
    id: 'card-1',
    household_id: 'hh-1',
    owner_id: 'member-1',
    name: 'Card',
    wallet_type: 'credit_card',
    is_shared: false,
    current_balance: 7000,
    credit_limit: 10000,
    service_fee_balance: 1000,
    created_at: '2026-10-03T00:00:00.000Z',
  },
] satisfies Wallet[];

const categories: Category[] = [];
const members = [
  {
    id: 'member-1',
    household_id: 'hh-1',
    user_id: null,
    role: 'admin',
    display_name: 'Steve',
    created_at: '2026-10-03T00:00:00.000Z',
  },
] satisfies HouseholdMember[];

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'tx-1',
    household_id: 'hh-1',
    wallet_id: 'bank-1',
    destination_wallet_id: 'card-1',
    category_id: null,
    payer_id: 'member-1',
    type: 'loan',
    amount: 7500,
    fee: 50,
    service_fee_amount: 1000,
    transaction_date: '2026-10-03',
    note: 'Card payment',
    receipt_url: null,
    created_at: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

describe('transaction CSV export', () => {
  it('includes the stored service-fee allocation immediately after amount', () => {
    const csv = buildTransactionsCsv([makeTransaction()], wallets, categories, members);
    const [header, row] = csv.split('\n');

    expect(header).toBe(
      'Transaction ID,Date,Type,Payer,Source Account,Destination Account,Category,Amount (PHP),Service Fee Amount (PHP),Note,Receipt URL',
    );
    expect(row).toContain(',7500.00,1000.00,');
  });

  it('normalizes a missing legacy service-fee allocation to zero', () => {
    const csv = buildTransactionsCsv(
      [makeTransaction({ id: 'legacy-tx', service_fee_amount: undefined })],
      wallets,
      categories,
      members,
    );

    expect(csv.split('\n')[1]).toContain(',7500.00,0.00,');
  });

  it('preserves escaped quotes in notes', () => {
    const csv = buildTransactionsCsv(
      [makeTransaction({ note: 'Paid "October" card bill' })],
      wallets,
      categories,
      members,
    );

    expect(csv.split('\n')[1]).toContain('"Paid ""October"" card bill"');
  });
});
