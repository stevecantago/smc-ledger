import { describe, expect, it } from 'vitest';
import { clearAuthStorage } from './storageKeys';
import { getSyncFailureWarning, getSyncStatus } from './persistence';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private items = new Map<string, string>();

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }
}

describe('local household persistence', () => {
  it('keeps a created wallet available after logout and the next login', () => {
    const storage = new MemoryStorage();
    const wallet = { id: 'wallet-new', name: 'New Wallet' };
    storage.setItem('smc_authenticated_email', 'admin@example.com');
    storage.setItem('smc_wallets', JSON.stringify([wallet]));

    clearAuthStorage(storage);
    storage.setItem('smc_authenticated_email', 'admin@example.com');

    expect(JSON.parse(storage.getItem('smc_wallets') ?? '[]')).toContainEqual(wallet);
  });

  it('keeps a created transaction available after logout and the next login', () => {
    const storage = new MemoryStorage();
    const transaction = { id: 'tx-new', amount: 500 };
    storage.setItem('smc_authenticated_email', 'admin@example.com');
    storage.setItem('smc_transactions', JSON.stringify([transaction]));

    clearAuthStorage(storage);
    storage.setItem('smc_authenticated_email', 'admin@example.com');

    expect(JSON.parse(storage.getItem('smc_transactions') ?? '[]')).toContainEqual(transaction);
  });
});

describe('Supabase sync status', () => {
  it('reports pending sync when Supabase is configured', () => {
    expect(getSyncStatus(true)).toBe('pending');
  });

  it('reports local-only saves when Supabase is not configured', () => {
    expect(getSyncStatus(false)).toBe('local_only');
  });

  it('turns failed Supabase writes into a visible warning message', () => {
    expect(getSyncFailureWarning('Create wallet', new Error('row-level security blocked insert'))).toBe(
      'Create wallet saved locally, but Supabase sync failed: row-level security blocked insert'
    );
  });
});
