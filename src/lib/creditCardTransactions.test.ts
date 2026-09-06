import { describe, expect, it } from 'vitest';
import { applyTransactionBalanceChange, reverseTransactionBalanceChange } from './creditCardTransactions';
import { Wallet } from '../types/database';

const bank: Wallet = {
  id: 'wallet-bank',
  household_id: 'hh-101',
  owner_id: 'member-admin',
  name: 'Bank',
  wallet_type: 'bank',
  is_shared: true,
  current_balance: 50000,
  credit_limit: null,
  created_at: '2026-09-06T00:00:00.000Z',
};

const card: Wallet = {
  id: 'wallet-card',
  household_id: 'hh-101',
  owner_id: 'member-admin',
  name: 'Credit Card',
  wallet_type: 'credit_card',
  is_shared: false,
  current_balance: 1000,
  credit_limit: 5000,
  created_at: '2026-09-06T00:00:00.000Z',
};

describe('credit card transaction balance rules', () => {
  it('increases used balance when logging an expense to a credit card', () => {
    const result = applyTransactionBalanceChange([bank, card], {
      wallet_id: card.id,
      type: 'expense',
      amount: 500,
      fee: 25,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(1525);
  });

  it('rejects credit card expenses above the available credit limit', () => {
    const result = applyTransactionBalanceChange([bank, card], {
      wallet_id: card.id,
      type: 'expense',
      amount: 4500,
      fee: 1,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Credit card charge exceeds available credit.');
    }
  });

  it('reduces used balance when transferring a payment into a credit card', () => {
    const result = applyTransactionBalanceChange([bank, card], {
      wallet_id: bank.id,
      destination_wallet_id: card.id,
      type: 'transfer',
      amount: 400,
      fee: 15,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === bank.id)?.current_balance).toBe(49585);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(600);
  });

  it('rejects credit card payments above the used balance', () => {
    const result = applyTransactionBalanceChange([bank, card], {
      wallet_id: bank.id,
      destination_wallet_id: card.id,
      type: 'transfer',
      amount: 1001,
      fee: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Credit card payment cannot exceed the used balance.');
    }
  });

  it('reverses a deleted credit card expense', () => {
    const result = reverseTransactionBalanceChange([bank, { ...card, current_balance: 1525 }], {
      wallet_id: card.id,
      type: 'expense',
      amount: 500,
      fee: 25,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(1000);
  });
});
