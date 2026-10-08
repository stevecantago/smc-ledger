import React, { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdProvider, useHousehold } from './HouseholdContext';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  writes: [] as { table: string; operation: string; payload?: unknown; id?: string }[],
}));

// Run provider actions with deterministic state, without mounting hydration effects.
// The accounting and permissions code, provider actions, and payloads remain real.
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useEffect: () => {},
    useState: (initial: unknown) => {
      const index = harness.cursor++;
      if (!(index in harness.states)) harness.states[index] = initial;
      return [harness.states[index], (next: unknown) => {
        harness.states[index] = typeof next === 'function' ? next(harness.states[index]) : next;
      }];
    },
  };
});

vi.mock('../lib/supabase', async importOriginal => {
  const actual = await importOriginal<typeof import('../lib/supabase')>();
  return {
    ...actual,
    initialWallets: actual.initialWallets.map(wallet => wallet.id === 'wallet-metrobank'
      ? { ...wallet, current_balance: 50000 }
      : wallet.id === 'wallet-unionbank-cc'
        ? { ...wallet, current_balance: 7000, service_fee_balance: 1000 }
        : wallet),
    supabase: {
      rpc: (name: string, payload: unknown) => {
        harness.writes.push({ table: name, operation: 'rpc', payload });
        return Promise.resolve({ error: null });
      },
      from: (table: string) => ({
        insert: (payload: unknown) => {
          harness.writes.push({ table, operation: 'insert', payload });
          return Promise.resolve({ error: null });
        },
        update: (payload: unknown) => ({ eq: (_field: string, id: string) => {
          harness.writes.push({ table, operation: 'update', payload, id });
          return Promise.resolve({ error: null });
        } }),
        delete: () => ({ eq: (_field: string, id: string) => {
          harness.writes.push({ table, operation: 'delete', id });
          return Promise.resolve({ error: null });
        } }),
      }),
    },
  };
});

type Household = ReturnType<typeof useHousehold>;
function renderProvider(): Household {
  harness.cursor = 0;
  const element = HouseholdProvider({ children: null }) as ReactElement<{ value: Household }>;
  return element.props.value;
}

const payment = {
  wallet_id: 'wallet-metrobank', destination_wallet_id: 'wallet-unionbank-cc',
  type: 'loan' as const, amount: 7500, fee: 50, transaction_date: '2026-10-03',
};

describe('household service-fee persistence', () => {
  beforeEach(() => {
    harness.states = [];
    harness.writes = [];
  });

  it('stores the payment allocation and sends no remote wallet balance updates', () => {
    expect(renderProvider().addTransaction(payment).success).toBe(true);
    const state = renderProvider();
    expect(state.transactions[0].service_fee_amount).toBe(1000);
    expect(state.wallets.find(wallet => wallet.id === payment.wallet_id)?.current_balance).toBe(42450);
    expect(state.wallets.find(wallet => wallet.id === payment.destination_wallet_id)).toMatchObject({
      current_balance: 500, service_fee_balance: 0,
    });
    expect(harness.writes.filter(write => write.table === 'wallets')).toEqual([]);
    expect(harness.writes.filter(write => write.table === 'transactions')).toEqual([
      { table: 'transactions', operation: 'insert', payload: [state.transactions[0]] },
    ]);
  });

  it('reverses the stored fee allocation locally and sends only the transaction deletion', () => {
    renderProvider().addTransaction(payment);
    const state = renderProvider();
    harness.writes = [];
    expect(state.deleteTransaction(state.transactions[0].id).success).toBe(true);
    const next = renderProvider();
    expect(next.wallets.find(wallet => wallet.id === payment.wallet_id)?.current_balance).toBe(50000);
    expect(next.wallets.find(wallet => wallet.id === payment.destination_wallet_id)).toMatchObject({
      current_balance: 7000, service_fee_balance: 1000,
    });
    expect(next.transactions).toEqual([]);
    expect(harness.writes.filter(write => write.table === 'wallets')).toEqual([]);
    expect(harness.writes.filter(write => write.table === 'transactions')).toEqual([
      { table: 'transactions', operation: 'delete', id: state.transactions[0].id },
    ]);
  });

  it('stores zero service-fee allocation for an ordinary expense', () => {
    renderProvider().addTransaction({ ...payment, type: 'expense', destination_wallet_id: null, amount: 100 });
    expect(renderProvider().transactions[0].service_fee_amount).toBe(0);
  });

  it('creates a card with an explicit zero outstanding fee balance', () => {
    renderProvider().addWallet({ name: 'New Card', wallet_type: 'credit_card', is_shared: false, initial_balance: 100 });
    expect(renderProvider().wallets.at(-1)?.service_fee_balance).toBe(0);
    expect(harness.writes.find(write => write.table === 'wallets')?.payload).toEqual([
      expect.objectContaining({ service_fee_balance: 0 }),
    ]);
  });

  it('preserves outstanding fees during unrelated card edits', () => {
    renderProvider().updateWallet(payment.destination_wallet_id, { name: 'Renamed Card', current_balance: -6000 });
    expect(renderProvider().wallets.find(wallet => wallet.id === payment.destination_wallet_id)).toMatchObject({
      name: 'Renamed Card', current_balance: 6000, service_fee_balance: 1000,
    });
    expect(harness.writes.find(write => write.table === 'wallets')?.payload).toEqual({
      name: 'Renamed Card', current_balance: 6000,
    });
  });

  it.each([-20, null])('normalizes an explicitly supplied fee balance of %s to zero', value => {
    renderProvider().updateWallet(payment.destination_wallet_id, { service_fee_balance: value });
    expect(renderProvider().wallets.find(wallet => wallet.id === payment.destination_wallet_id)?.service_fee_balance).toBe(0);
    expect(harness.writes.find(write => write.table === 'wallets')?.payload).toEqual({ service_fee_balance: 0 });
  });

  it('restores wallets and transactions through one remote atomic operation with saved allocations', () => {
    const backupWallets = [
      { ...renderProvider().wallets.find(wallet => wallet.id === payment.wallet_id)!, current_balance: 42450 },
      {
        ...renderProvider().wallets.find(wallet => wallet.id === payment.destination_wallet_id)!,
        current_balance: 500,
        service_fee_balance: 0,
      },
    ];
    const backupTransactions = [{
      id: 'historical-payment',
      household_id: 'hh-101',
      payer_id: 'member-steve-admin',
      category_id: null,
      receipt_url: null,
      note: 'Historical payment',
      created_at: '2026-09-01T00:00:00.000Z',
      ...payment,
      service_fee_amount: 1000,
    }];

    const result = renderProvider().restoreFullHouseholdBackup(JSON.stringify({
      wallets: backupWallets,
      transactions: backupTransactions,
    }));

    expect(result.success).toBe(true);
    expect(renderProvider().wallets.find(wallet => wallet.id === payment.destination_wallet_id)).toMatchObject({
      current_balance: 500,
      service_fee_balance: 0,
    });
    expect(renderProvider().transactions[0].service_fee_amount).toBe(1000);
    expect(harness.writes.filter(write => ['wallets', 'transactions'].includes(write.table))).toEqual([]);
    expect(harness.writes.find(write => write.operation === 'rpc')).toEqual({
      table: 'restore_wallets_and_transactions',
      operation: 'rpc',
      payload: {
        p_wallets: backupWallets,
        p_transactions: backupTransactions,
      },
    });
  });
});
