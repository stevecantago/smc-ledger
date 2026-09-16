import { describe, expect, it } from 'vitest';
import { Wallet } from '../types/database';
import {
  buildCreditCardPaymentSchedules,
  filterCreditCardPaymentSchedules,
  getNextCreditCardPaymentDate,
} from './creditCardPaymentSchedules';

const baseWallet: Wallet = {
  id: 'wallet-card',
  household_id: 'household-1',
  owner_id: 'member-1',
  name: 'Maya Credit',
  wallet_type: 'credit_card',
  is_shared: false,
  current_balance: 7000,
  credit_limit: 7000,
  created_at: '2026-09-01T00:00:00.000Z',
};

describe('credit card payment schedules', () => {
  it.each([
    [new Date(2026, 8, 4), '2026-09-05'],
    [new Date(2026, 8, 5), '2026-09-05'],
    [new Date(2026, 8, 6), '2026-09-20'],
    [new Date(2026, 8, 20), '2026-09-20'],
    [new Date(2026, 8, 21), '2026-10-05'],
    [new Date(2026, 11, 21), '2027-01-05'],
  ])('uses the next upcoming 5th or 20th for %s', (today, expected) => {
    expect(getNextCreditCardPaymentDate(today)).toBe(expected);
  });

  it('creates a payment due for the full live used balance', () => {
    expect(buildCreditCardPaymentSchedules([baseWallet], new Date(2026, 8, 17))).toEqual([
      {
        id: 'credit-card-payment-wallet-card',
        walletId: 'wallet-card',
        walletName: 'Maya Credit',
        amount: 7000,
        dueDate: '2026-09-20',
      },
    ]);
  });

  it('omits paid-off cards and non-credit wallets', () => {
    expect(buildCreditCardPaymentSchedules([
      { ...baseWallet, current_balance: 0 },
      { ...baseWallet, id: 'wallet-cash', wallet_type: 'cash', current_balance: 500 },
    ], new Date(2026, 8, 17))).toEqual([]);
  });

  it('normalizes a legacy negative card balance into the scheduled amount', () => {
    const schedules = buildCreditCardPaymentSchedules([
      { ...baseWallet, current_balance: -1250.5 },
    ], new Date(2026, 8, 17));

    expect(schedules[0]?.amount).toBe(1250.5);
  });

  it('filters derived payments by card and due-date range', () => {
    const schedules = [
      { id: 'one', walletId: 'card-1', walletName: 'Card One', amount: 100, dueDate: '2026-09-20' },
      { id: 'two', walletId: 'card-2', walletName: 'Card Two', amount: 200, dueDate: '2026-10-05' },
    ];

    expect(filterCreditCardPaymentSchedules(schedules, {
      walletId: 'card-2',
      fromDate: '2026-10-01',
      toDate: '2026-10-31',
    })).toEqual([schedules[1]]);
  });
});
