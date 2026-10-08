import React, { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HouseholdProvider, useHousehold } from './HouseholdContext';

const harness = vi.hoisted(() => ({
  states: [] as unknown[],
  cursor: 0,
  writes: [] as { table: string; operation: string; payload?: unknown; id?: string }[],
  remoteEvents: [] as string[],
  remoteGates: {} as Record<string, Promise<{ error: unknown }>>,
  remoteErrors: {} as Record<string, unknown>,
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
    initialWallets: actual.initialWallets.map(wallet => wallet.id === 'wallet-demo-bank'
      ? { ...wallet, current_balance: 50000 }
      : wallet.id === 'wallet-demo-credit'
        ? { ...wallet, current_balance: 7000, service_fee_balance: 1000 }
        : wallet),
    supabase: {
      rpc: (name: string, payload: unknown) => {
        harness.writes.push({ table: name, operation: 'rpc', payload });
        const key = `${name}:rpc`;
        harness.remoteEvents.push(key);
        return harness.remoteGates[key]
          || Promise.resolve({ error: harness.remoteErrors[key] || null });
      },
      from: (table: string) => ({
        insert: (payload: unknown) => {
          harness.writes.push({ table, operation: 'insert', payload });
          const key = `${table}:insert`;
          harness.remoteEvents.push(key);
          return harness.remoteGates[key]
            || Promise.resolve({ error: harness.remoteErrors[key] || null });
        },
        upsert: (payload: unknown) => {
          harness.writes.push({ table, operation: 'upsert', payload });
          const key = `${table}:upsert`;
          harness.remoteEvents.push(key);
          return harness.remoteGates[key]
            || Promise.resolve({ error: harness.remoteErrors[key] || null });
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
  wallet_id: 'wallet-demo-bank', destination_wallet_id: 'wallet-demo-credit',
  type: 'loan' as const, amount: 7500, fee: 50, transaction_date: '2026-10-03',
};

describe('household service-fee persistence', () => {
  beforeEach(() => {
    harness.states = [];
    harness.writes = [];
    harness.remoteEvents = [];
    harness.remoteGates = {};
    harness.remoteErrors = {};
  });

  it('stores one normalized fee value for local accounting and remote persistence', () => {
    expect(renderProvider().addTransaction({ ...payment, fee: 50.004 }).success).toBe(true);
    const state = renderProvider();
    expect(state.transactions[0].fee).toBe(50);
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

  it('rejects a negative transaction fee before changing local or remote financial state', () => {
    const before = renderProvider();
    const beforeWallets = before.wallets;
    const beforeTransactions = before.transactions;
    harness.writes = [];

    expect(before.addTransaction({ ...payment, fee: -50 })).toEqual({
      success: false,
      error: 'Transaction fee cannot be negative.',
    });
    expect(renderProvider().wallets).toEqual(beforeWallets);
    expect(renderProvider().transactions).toEqual(beforeTransactions);
    expect(harness.writes).toEqual([]);
  });

  it('rejects a negative transaction fee update before changing local or remote state', () => {
    renderProvider().addTransaction(payment);
    const before = renderProvider();
    const beforeTransactions = before.transactions;
    harness.writes = [];

    expect(before.updateTransaction(beforeTransactions[0].id, { fee: -0.01 })).toEqual({
      success: false,
      error: 'Transaction fee cannot be negative.',
    });
    expect(renderProvider().transactions).toEqual(beforeTransactions);
    expect(harness.writes).toEqual([]);
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

  it('restores wallets and transactions through one remote atomic operation with saved allocations', async () => {
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
      payer_id: 'member-demo-admin',
      category_id: null,
      receipt_url: null,
      note: 'Historical payment',
      created_at: '2026-09-01T00:00:00.000Z',
      ...payment,
      service_fee_amount: 1000,
    }];

    const result = await renderProvider().restoreFullHouseholdBackup(JSON.stringify({
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

  it.each([
    ['an empty wallet snapshot', false],
    ['a partial wallet snapshot', true],
  ])('rejects %s before changing local state or starting remote writes', async (_label, includeSourceWallet) => {
    const before = renderProvider();
    const beforeWallets = before.wallets;
    const beforeTransactions = before.transactions;
    const backupWallets = includeSourceWallet
      ? [{
          ...before.wallets.find(wallet => wallet.id === payment.wallet_id)!,
          current_balance: 42450,
        }]
      : [];
    harness.writes = [];

    const result = await before.restoreFullHouseholdBackup(JSON.stringify({
      wallets: backupWallets,
      transactions: [{
        id: 'historical-payment',
        household_id: 'hh-101',
        payer_id: 'member-demo-admin',
        category_id: null,
        receipt_url: null,
        note: 'Historical payment',
        created_at: '2026-09-01T00:00:00.000Z',
        ...payment,
        service_fee_amount: 1000,
      }],
    }));

    expect(result).toEqual({
      success: false,
      error: 'Backup must include a complete, unique wallet snapshot for every transaction.',
    });
    expect(renderProvider().wallets).toEqual(beforeWallets);
    expect(renderProvider().transactions).toEqual(beforeTransactions);
    expect(harness.writes).toEqual([]);
  });

  it('restores roles before members, then waits for members and categories before the financial RPC', async () => {
    const before = renderProvider();
    const backupWallets = before.wallets.map(wallet => wallet.id === payment.wallet_id
      ? { ...wallet, current_balance: 42450 }
      : wallet.id === payment.destination_wallet_id
        ? { ...wallet, current_balance: 500, service_fee_balance: 0 }
        : wallet);
    const backupTransactions = [{
      id: 'ordered-payment',
      household_id: 'hh-101',
      payer_id: 'member-demo-admin',
      category_id: null,
      receipt_url: null,
      note: 'Ordered payment',
      created_at: '2026-09-01T00:00:00.000Z',
      ...payment,
      service_fee_amount: 1000,
    }];
    let releaseRoles!: (value: { error: unknown }) => void;
    let releaseMembers!: (value: { error: unknown }) => void;
    let releaseCategories!: (value: { error: unknown }) => void;
    let releaseFinancialRestore!: (value: { error: unknown }) => void;
    harness.remoteGates['household_roles:upsert'] = new Promise(resolve => { releaseRoles = resolve; });
    harness.remoteGates['household_members:upsert'] = new Promise(resolve => { releaseMembers = resolve; });
    harness.remoteGates['categories:upsert'] = new Promise(resolve => { releaseCategories = resolve; });
    harness.remoteGates['restore_wallets_and_transactions:rpc'] = new Promise(resolve => {
      releaseFinancialRestore = resolve;
    });

    const restorePromise = before.restoreFullHouseholdBackup(JSON.stringify({
      customRoles: before.customRoles,
      members: before.members,
      categories: before.categories,
      wallets: backupWallets,
      transactions: backupTransactions,
    }));
    await Promise.resolve();

    expect(harness.remoteEvents).toEqual(['household_roles:upsert']);
    expect(renderProvider().wallets).toEqual(before.wallets);
    releaseRoles({ error: null });
    await vi.waitFor(() => {
      expect(harness.remoteEvents).toEqual([
        'household_roles:upsert',
        'household_members:upsert',
      ]);
    });
    releaseMembers({ error: null });
    await vi.waitFor(() => {
      expect(harness.remoteEvents).toEqual([
        'household_roles:upsert',
        'household_members:upsert',
        'categories:upsert',
      ]);
    });
    expect(harness.remoteEvents).not.toContain('restore_wallets_and_transactions:rpc');

    releaseCategories({ error: null });
    await vi.waitFor(() => {
      expect(harness.remoteEvents).toContain('restore_wallets_and_transactions:rpc');
    });
    expect(renderProvider().wallets).toEqual(before.wallets);
    releaseFinancialRestore({ error: null });
    const result = await restorePromise;
    expect(result.success).toBe(true);
    expect(harness.remoteEvents.indexOf('restore_wallets_and_transactions:rpc')).toBeGreaterThan(
      harness.remoteEvents.indexOf('categories:upsert'),
    );
    expect(renderProvider().wallets.find(wallet => wallet.id === payment.wallet_id)?.current_balance).toBe(42450);
  });

  it('returns a remote restore failure without replacing local financial state', async () => {
    const before = renderProvider();
    const beforeWallets = before.wallets;
    const beforeTransactions = before.transactions;
    harness.remoteErrors['restore_wallets_and_transactions:rpc'] = { message: 'financial restore denied' };

    const result = await before.restoreFullHouseholdBackup(JSON.stringify({
      wallets: before.wallets.map(wallet => ({ ...wallet, current_balance: 1 })),
      transactions: [],
    }));

    expect(result).toEqual({
      success: false,
      error: 'Restore wallets and transactions failed: financial restore denied',
    });
    expect(renderProvider().wallets).toEqual(beforeWallets);
    expect(renderProvider().transactions).toEqual(beforeTransactions);
  });
});
