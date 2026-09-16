import { describe, expect, it } from 'vitest';
import {
  applyTransactionBalanceChange,
  getCreditCardAvailableCredit,
  getCreditCardUsedBalance,
  getRequiredCreditCardFunding,
  reverseTransactionBalanceChange,
} from './creditCardTransactions';
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
  it('requires Steve\'s Maya Wallet for Maya Credit - Steve', () => {
    const mayaWallet: Wallet = {
      ...bank,
      id: 'wallet-maya-steve',
      name: 'Maya Wallet - Steve',
      owner_id: 'member-steve',
    };
    const anotherMayaWallet: Wallet = {
      ...mayaWallet,
      id: 'wallet-maya-other',
      owner_id: 'member-other',
    };
    const mayaCredit: Wallet = {
      ...card,
      id: 'wallet-maya-credit',
      name: 'Maya Credit - Steve',
      owner_id: 'member-steve',
    };
    expect(getRequiredCreditCardFunding(mayaCredit, [anotherMayaWallet, mayaWallet, mayaCredit])).toEqual({
      locked: true,
      walletId: 'wallet-maya-steve',
    });
  });

  it('requires Steve\'s Maya Wallet for Maya Black - Steve', () => {
    const mayaWallet: Wallet = {
      ...bank,
      id: 'wallet-maya-steve',
      name: 'Maya Wallet - Steve',
      owner_id: 'member-steve',
    };
    const mayaBlack: Wallet = {
      ...card,
      id: 'wallet-maya-black',
      name: 'Maya Black - Steve',
      owner_id: 'member-steve',
    };

    expect(getRequiredCreditCardFunding(mayaBlack, [mayaWallet, mayaBlack])).toEqual({
      locked: true,
      walletId: 'wallet-maya-steve',
    });
  });

  it.each(['Maya Credit', 'Maya Black Card'])(
    'requires the owner-matched Maya Wallet for the default %s account',
    (cardName) => {
      const mayaWallet: Wallet = {
        ...bank,
        id: 'wallet-maya-default',
        name: 'Maya Wallet',
        owner_id: 'member-steve',
      };
      const mayaCard: Wallet = {
        ...card,
        id: 'wallet-maya-card',
        name: cardName,
        owner_id: 'member-steve',
      };

      expect(getRequiredCreditCardFunding(mayaCard, [mayaWallet, mayaCard])).toEqual({
        locked: true,
        walletId: 'wallet-maya-default',
      });
    },
  );

  it('keeps the funding account editable for other credit cards', () => {
    expect(getRequiredCreditCardFunding(card, [bank, card])).toEqual({
      locked: false,
      walletId: null,
    });
  });

  it('locks a configured Maya card even when its required wallet is missing', () => {
    const mayaCredit = {
      ...card,
      name: 'Maya Credit - Steve',
      owner_id: 'member-steve',
    };

    expect(getRequiredCreditCardFunding(mayaCredit, [mayaCredit])).toEqual({
      locked: true,
      walletId: null,
    });
  });

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

  it('normalizes a legacy negative credit card balance before applying a new expense', () => {
    const result = applyTransactionBalanceChange([bank, { ...card, current_balance: -450 }], {
      wallet_id: card.id,
      type: 'expense',
      amount: 300,
      fee: 0,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(750);
  });

  it('shows legacy negative credit card balances as positive used balance and reduced available credit', () => {
    const legacyCard = { ...card, current_balance: -450, credit_limit: 10000 };

    expect(getCreditCardUsedBalance(legacyCard)).toBe(450);
    expect(getCreditCardAvailableCredit(legacyCard)).toBe(9550);
  });

  it('normalizes a legacy negative credit card balance before applying a payment', () => {
    const result = applyTransactionBalanceChange([bank, { ...card, current_balance: -450 }], {
      wallet_id: bank.id,
      destination_wallet_id: card.id,
      type: 'transfer',
      amount: 200,
      fee: 0,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(250);
  });

  it('records a credit card payment as a loan transaction against both accounts', () => {
    const result = applyTransactionBalanceChange([bank, card], {
      wallet_id: bank.id,
      destination_wallet_id: card.id,
      type: 'loan',
      amount: 400,
      fee: 15,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === bank.id)?.current_balance).toBe(49585);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(600);
  });

  it('restores both accounts when deleting a credit card loan payment', () => {
    const result = reverseTransactionBalanceChange([
      { ...bank, current_balance: 49585 },
      { ...card, current_balance: 600 },
    ], {
      wallet_id: bank.id,
      destination_wallet_id: card.id,
      type: 'loan',
      amount: 400,
      fee: 15,
    });

    expect(result.success).toBe(true);
    expect(result.wallets.find(w => w.id === bank.id)?.current_balance).toBe(50000);
    expect(result.wallets.find(w => w.id === card.id)?.current_balance).toBe(1000);
  });

  it('rejects using another credit card to fund a credit card loan payment', () => {
    const fundingCard = { ...card, id: 'wallet-funding-card', current_balance: 250 };
    const result = applyTransactionBalanceChange([fundingCard, card], {
      wallet_id: fundingCard.id,
      destination_wallet_id: card.id,
      type: 'loan',
      amount: 100,
      fee: 0,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Credit card payments require a non-credit funding account.');
    }
  });
});
