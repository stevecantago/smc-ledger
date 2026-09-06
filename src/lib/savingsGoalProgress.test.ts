import { describe, expect, it } from 'vitest';
import { getSavingsGoalProgress } from './savingsGoalProgress';
import { SavingsGoal, Wallet } from '../types/database';

const goal: SavingsGoal = {
  id: 'goal-1',
  household_id: 'hh-101',
  name: 'Tuition Fund',
  target_amount: 10000,
  current_amount: 1500,
  wallet_id: 'wallet-savings',
  target_date: null,
  created_at: '2026-09-07T00:00:00.000Z',
};

const wallet: Wallet = {
  id: 'wallet-savings',
  household_id: 'hh-101',
  owner_id: 'member-admin',
  name: 'Maya Savings',
  wallet_type: 'e_wallet_savings',
  is_shared: true,
  current_balance: 4200,
  credit_limit: null,
  created_at: '2026-09-07T00:00:00.000Z',
};

describe('getSavingsGoalProgress', () => {
  it('tracks progress from the linked wallet balance', () => {
    const progress = getSavingsGoalProgress(goal, [wallet]);

    expect(progress.currentAmount).toBe(4200);
    expect(progress.percent).toBe(42);
    expect(progress.linkedWallet?.name).toBe('Maya Savings');
  });

  it('falls back to the saved goal amount when no wallet is linked', () => {
    const progress = getSavingsGoalProgress({ ...goal, wallet_id: null }, [wallet]);

    expect(progress.currentAmount).toBe(1500);
    expect(progress.percent).toBe(15);
    expect(progress.linkedWallet).toBeNull();
  });
});
