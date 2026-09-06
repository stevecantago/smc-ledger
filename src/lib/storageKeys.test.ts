import { describe, expect, it } from 'vitest';
import { AUTH_STORAGE_KEYS, HOUSEHOLD_STORAGE_KEYS, clearAuthStorage, clearHouseholdStorage } from './storageKeys';

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

describe('logout storage behavior', () => {
  it('removes only auth keys during logout and preserves household data', () => {
    const storage = new MemoryStorage();
    AUTH_STORAGE_KEYS.forEach(key => storage.setItem(key, 'signed-in'));
    HOUSEHOLD_STORAGE_KEYS.forEach(key => storage.setItem(key, `${key}-data`));
    storage.setItem('unrelated_app_key', 'keep');

    clearAuthStorage(storage);

    AUTH_STORAGE_KEYS.forEach(key => expect(storage.getItem(key)).toBeNull());
    HOUSEHOLD_STORAGE_KEYS.forEach(key => expect(storage.getItem(key)).toBe(`${key}-data`));
    expect(storage.getItem('unrelated_app_key')).toBe('keep');
  });

  it('clears household data only through the explicit reset path', () => {
    const storage = new MemoryStorage();
    AUTH_STORAGE_KEYS.forEach(key => storage.setItem(key, 'signed-in'));
    HOUSEHOLD_STORAGE_KEYS.forEach(key => storage.setItem(key, `${key}-data`));
    storage.setItem('unrelated_app_key', 'keep');

    clearHouseholdStorage(storage);

    AUTH_STORAGE_KEYS.forEach(key => expect(storage.getItem(key)).toBe('signed-in'));
    HOUSEHOLD_STORAGE_KEYS.forEach(key => expect(storage.getItem(key)).toBeNull());
    expect(storage.getItem('unrelated_app_key')).toBe('keep');
  });
});
