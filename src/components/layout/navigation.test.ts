import { describe, expect, it } from 'vitest';
import { allNavigationItems, moreNavigationItems, primaryNavigationItems } from './navigation';

describe('responsive navigation destinations', () => {
  it('keeps the five primary mobile destinations in order', () => {
    expect(primaryNavigationItems.map(({ label }) => label)).toEqual(['Dashboard', 'Ledger', 'Wallets', 'Goals']);
  });

  it('keeps every deferred destination available through More', () => {
    expect(moreNavigationItems.map(({ label }) => label)).toEqual(['Loans', 'Schedules', 'Roster', 'Activity Log', 'Setting']);
    expect(new Set(allNavigationItems.map(({ id }) => id)).size).toBe(9);
  });
});
