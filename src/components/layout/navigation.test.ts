import { describe, expect, it } from 'vitest';
import { allNavigationItems, desktopBottomNavigationItems, desktopPrimaryNavigationItems, moreNavigationItems, primaryNavigationItems } from './navigation';

describe('responsive navigation destinations', () => {
  it('keeps the four primary mobile destinations in order', () => {
    expect(primaryNavigationItems.map(({ label }) => label)).toEqual(['Dashboard', 'Ledger', 'Wallets', 'Goals']);
  });

  it('places Schedules immediately before Goals in the desktop sidebar', () => {
    expect(desktopPrimaryNavigationItems.map(({ label }) => label)).toEqual(['Dashboard', 'Ledger', 'Wallets', 'Schedules', 'Goals', 'Loans & Amortizations']);
  });

  it('places System Logs after Settings at the bottom of the desktop sidebar', () => {
    expect(desktopBottomNavigationItems.map(({ label }) => label)).toEqual(['Settings', 'System Logs']);
  });

  it('keeps every deferred destination available through More', () => {
    expect(moreNavigationItems.map(({ label }) => label)).toEqual(['Loans & Amortizations', 'Schedules', 'Settings', 'System Logs']);
    expect(new Set(allNavigationItems.map(({ id }) => id)).size).toBe(8);
  });
});
