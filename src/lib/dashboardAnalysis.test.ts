import { describe, expect, it } from 'vitest';
import type { Category, HouseholdMember, Transaction } from '../types/database';
import { buildDashboardAnalysis, getAnalysisRange, getAnalysisRangeError, isCalendarDate, manilaToday } from './dashboardAnalysis';

const custom = { start: '2026-10-01', end: '2026-10-31' };
function tx(overrides: Partial<Transaction> = {}): Transaction {
  return { id: 'tx', household_id: 'home', wallet_id: 'wallet', payer_id: 'member', type: 'expense', amount: 10, transaction_date: '2026-10-09', created_at: '2026-10-09T00:00:00Z', ...overrides };
}
const categories: Category[] = [{ id: 'food', household_id: 'home', name: 'Food', icon_slug: 'food', category_type: 'expense', monthly_budget_limit: 100, created_at: '' }];
const members: HouseholdMember[] = [{ id: 'member', household_id: 'home', user_id: null, role: 'admin', display_name: 'Steve', created_at: '' }];

describe('dashboard calendar periods', () => {
  it('uses Manila’s calendar day across UTC midnight boundaries', () => {
    expect(manilaToday(new Date('2026-10-08T16:01:00Z'))).toBe('2026-10-09');
    expect(manilaToday(new Date('2026-10-08T15:59:00Z'))).toBe('2026-10-08');
  });
  it('handles Monday weeks, month/year boundaries and leap days', () => {
    expect(getAnalysisRange('today', '2026-10-09', custom)).toEqual({ start: '2026-10-09', end: '2026-10-09' });
    expect(getAnalysisRange('this_week', '2026-10-11', custom)).toEqual({ start: '2026-10-05', end: '2026-10-11' });
    expect(getAnalysisRange('this_month', '2024-02-20', custom)).toEqual({ start: '2024-02-01', end: '2024-02-29' });
    expect(getAnalysisRange('last_month', '2026-01-09', custom)).toEqual({ start: '2025-12-01', end: '2025-12-31' });
    expect(getAnalysisRange('this_year', '2026-10-09', custom)).toEqual({ start: '2026-01-01', end: '2026-12-31' });
    expect(getAnalysisRange('all_time', '2026-10-09', custom)).toEqual({ start: '', end: '' });
    expect(getAnalysisRange('custom', '2026-10-09', custom)).toEqual(custom);
  });
  it('rejects impossible or reversed dates', () => {
    expect(isCalendarDate('2026-02-30')).toBe(false);
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(getAnalysisRangeError({ start: '2026-10-02', end: '2026-10-01' })).toBeTruthy();
    expect(getAnalysisRangeError({ start: '2026-02-30', end: '2026-03-01' })).toBeTruthy();
  });
});

describe('read-only dashboard analysis', () => {
  it('filters inclusive dates, keeps income gross, adds expense fees and excludes transfers/loans', () => {
    const records = [
      tx({ id: 'first', transaction_date: '2026-10-01', amount: 100, fee: 2.5, category_id: 'food' }),
      tx({ id: 'last', transaction_date: '2026-10-31', amount: 50, fee: 1, category_id: 'food' }),
      tx({ type: 'income', amount: 200, fee: 7 }),
      tx({ type: 'transfer', amount: 500, fee: 12, service_fee_amount: 40 }),
      tx({ type: 'loan', amount: 600, fee: 20 }),
      tx({ transaction_date: '2026-09-30', amount: 1000 }),
      tx({ transaction_date: '2026-11-01', amount: 2000 }),
    ];
    const original = JSON.stringify(records);
    const result = buildDashboardAnalysis(records, categories, members, custom);
    expect(result.income).toBe(200);
    expect(result.expenses).toBe(153.5);
    expect(result.transactionCount).toBe(3);
    expect(result.categories).toEqual([{ id: 'food', label: 'Food', amount: 153.5, count: 2, average: 76.75 }]);
    expect(result.members[0]).toMatchObject({ label: 'Steve', amount: 153.5, count: 2 });
    expect(result.daily).toHaveLength(31);
    expect(result.daily[0]).toEqual({ date: '2026-10-01', income: 0, expenses: 102.5 });
    expect(result.daily[1]).toEqual({ date: '2026-10-02', income: 0, expenses: 0 });
    expect(JSON.stringify(records)).toBe(original);
  });
  it('aggregates centavos and provides unknown-category/member fallbacks', () => {
    const result = buildDashboardAnalysis([tx({ amount: .1, fee: .2, payer_id: 'missing' }), tx({ amount: .2, payer_id: 'missing' })], [], [], custom);
    expect(result.expenses).toBe(.5);
    expect(result.categories[0]).toMatchObject({ label: 'Uncategorized', count: 2, average: .25 });
    expect(result.members[0].label).toBe('Unassigned member');
  });
  it('shows empty financial activity for transfers alone, invalid dates and invalid ranges', () => {
    expect(buildDashboardAnalysis([tx({ type: 'transfer' })], [], [], custom).daily).toEqual([]);
    expect(buildDashboardAnalysis([tx({ transaction_date: '2026-10-99' })], [], [], custom).transactionCount).toBe(0);
    expect(buildDashboardAnalysis([tx()], [], [], { start: '2026-10-31', end: '2026-10-01' }).expenses).toBe(0);
  });
  it('retains every activity date in long all-time ranges without filling years of zero days', () => {
    const result = buildDashboardAnalysis([tx({ transaction_date: '2000-01-01' }), tx({ transaction_date: '2026-10-09' })], [], [], { start: '', end: '' });
    expect(result.daily.map(day => day.date)).toEqual(['2000-01-01', '2000-01-02', '2026-10-08', '2026-10-09']);
    expect(result.expenses).toBe(20);
  });
});
