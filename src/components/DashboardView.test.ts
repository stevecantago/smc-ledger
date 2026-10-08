import { describe, expect, it } from 'vitest';
import { DASHBOARD_FINANCIAL_LABELS } from './dashboardLabels';

describe('dashboard financial labels', () => {
  it('qualifies loaded-ledger totals and the visible-wallet balance scope', () => {
    expect(DASHBOARD_FINANCIAL_LABELS.income).toBe('Income in loaded ledger');
    expect(DASHBOARD_FINANCIAL_LABELS.expenses).toBe('Expenses in loaded ledger');
    expect(DASHBOARD_FINANCIAL_LABELS.incomeNote).toBe('Based on currently loaded records.');
    expect(DASHBOARD_FINANCIAL_LABELS.expensesNote).toBe('Based on currently loaded records. Expenses include transaction fees.');
    expect(DASHBOARD_FINANCIAL_LABELS.liquidBalances).toBe('Liquid balances less used card balances');
    expect(DASHBOARD_FINANCIAL_LABELS.liquidBalancesNote).toBe('For visible wallets. Excludes outstanding card service fees and separate loan principal.');
  });
});
