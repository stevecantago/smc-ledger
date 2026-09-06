import { describe, expect, it } from 'vitest';
import {
  getCurrentLedgerCycle,
  getInitialLedgerCycleFilter,
  getNextLedgerCycle,
  shouldResetCycleFilterOnDate,
} from './billingCycles';

describe('billing cycle date filters', () => {
  it('uses the 5th to 19th cycle for dates inside the first cycle', () => {
    expect(getCurrentLedgerCycle(new Date(2026, 8, 7))).toEqual({
      startDate: '2026-09-05',
      endDate: '2026-09-19',
    });
  });

  it('uses the 20th to next month 4th cycle for dates inside the second cycle', () => {
    expect(getCurrentLedgerCycle(new Date(2026, 8, 25))).toEqual({
      startDate: '2026-09-20',
      endDate: '2026-10-04',
    });
  });

  it('uses the previous month 20th cycle for dates from the 1st to the 4th', () => {
    expect(getCurrentLedgerCycle(new Date(2026, 9, 2))).toEqual({
      startDate: '2026-09-20',
      endDate: '2026-10-04',
    });
  });

  it('advances from a 5th cycle to the following 20th cycle', () => {
    expect(getNextLedgerCycle({ startDate: '2026-09-05', endDate: '2026-09-19' })).toEqual({
      startDate: '2026-09-20',
      endDate: '2026-10-04',
    });
  });

  it('keeps saved dates unless today is a cycle start', () => {
    const saved = { startDate: '2026-09-05', endDate: '2026-09-19' };
    expect(getInitialLedgerCycleFilter(new Date(2026, 8, 12), saved)).toEqual(saved);
    expect(shouldResetCycleFilterOnDate(new Date(2026, 8, 20))).toBe(true);
    expect(getInitialLedgerCycleFilter(new Date(2026, 8, 20), saved)).toEqual({
      startDate: '2026-09-20',
      endDate: '2026-10-04',
    });
  });
});
