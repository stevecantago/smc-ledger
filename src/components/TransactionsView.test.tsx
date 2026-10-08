import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  CreditCardPaymentPreview,
  TransactionsView,
  getCreditCardDestinationHelpText,
  getCreditCardPaymentAmountError,
} from './TransactionsView';

const household = vi.hoisted(() => ({
  transactions: [
    {
      id: 'card-payment',
      household_id: 'household-1',
      wallet_id: 'bank-1',
      destination_wallet_id: 'card-1',
      category_id: null,
      payer_id: 'member-1',
      type: 'loan' as const,
      amount: 7500,
      fee: 50,
      service_fee_amount: 1000,
      transaction_date: '2026-10-03',
      note: 'Credit card payment',
      receipt_url: null,
      created_at: '2026-10-03T00:00:00.000Z',
    },
    {
      id: 'legacy-card-payment',
      household_id: 'household-1',
      wallet_id: 'bank-1',
      destination_wallet_id: 'card-1',
      category_id: null,
      payer_id: 'member-1',
      type: 'loan' as const,
      amount: 500,
      fee: 0,
      transaction_date: '2026-09-03',
      note: 'Legacy credit card payment',
      receipt_url: null,
      created_at: '2026-09-03T00:00:00.000Z',
    },
  ],
  wallets: [
    {
      id: 'bank-1',
      household_id: 'household-1',
      owner_id: 'member-1',
      name: 'Bank',
      wallet_type: 'bank' as const,
      is_shared: true,
      current_balance: 50000,
      credit_limit: null,
      service_fee_balance: 0,
      created_at: '2026-10-03T00:00:00.000Z',
    },
    {
      id: 'card-1',
      household_id: 'household-1',
      owner_id: 'member-1',
      name: 'Card',
      wallet_type: 'credit_card' as const,
      is_shared: false,
      current_balance: 500,
      credit_limit: 10000,
      service_fee_balance: 0,
      created_at: '2026-10-03T00:00:00.000Z',
    },
  ],
  categories: [],
  loans: [],
  recurringTransfers: [],
  members: [
    {
      id: 'member-1',
      household_id: 'household-1',
      user_id: null,
      role: 'admin' as const,
      display_name: 'Steve',
      created_at: '2026-10-03T00:00:00.000Z',
    },
  ],
  currentMember: {
    id: 'member-1',
    household_id: 'household-1',
    user_id: null,
    role: 'admin' as const,
    display_name: 'Steve',
    created_at: '2026-10-03T00:00:00.000Z',
  },
  isAdmin: true,
  addTransaction: vi.fn(),
  updateTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  canEditTransaction: () => false,
  updateRecurringTransfer: vi.fn(),
  deleteRecurringTransfer: vi.fn(),
  payLoanAmortization: vi.fn(),
}));

vi.mock('../context/HouseholdContext', () => ({
  useHousehold: () => household,
}));

describe('credit-card payment entry', () => {
  it('shows the fee-first allocation and total cash deduction', () => {
    const html = renderToStaticMarkup(
      <CreditCardPaymentPreview
        allocation={{
          serviceFeePaid: 1000,
          usedBalancePaid: 6500,
          remainingServiceFees: 0,
          remainingUsedBalance: 500,
        }}
        transactionFee={50}
        totalCashDeducted={7550}
      />,
    );
    const text = html.replace(/<[^>]*>/g, '');

    expect(text).toContain('Service Fees Paid₱1000.00');
    expect(text).toContain('Used Balance Paid₱6500.00');
    expect(text).toContain('Transaction Fee₱50.00');
    expect(text).toContain('Total Cash Deducted₱7550.00');
  });

  it('rejects only credit-card payments above total due', () => {
    expect(getCreditCardPaymentAmountError(true, 8000.01, 8000)).toBe(
      'Credit card payment cannot exceed total due.',
    );
    expect(getCreditCardPaymentAmountError(true, 8000, 8000)).toBeNull();
    expect(getCreditCardPaymentAmountError(false, 8000.01, 8000)).toBeNull();
  });

  it('accepts a decimal payment exactly equal to the card total due', () => {
    expect(getCreditCardPaymentAmountError(true, 3510.40, 3500.20 + 10.20)).toBeNull();
  });

  it('uses fee-first copy only for actual credit-card payments', () => {
    expect(getCreditCardDestinationHelpText(true, 'credit_card')).toBe(
      'This payment clears service fees first, then reduces used balance.',
    );
    expect(getCreditCardDestinationHelpText(false, 'credit_card')).toBe(
      'Transfers into this card reduce used balance only; service fees stay unchanged.',
    );
    expect(getCreditCardDestinationHelpText(false, 'bank')).toBeNull();
  });

  it('shows a positive stored service-fee allocation in desktop and mobile ledgers only', () => {
    const html = renderToStaticMarkup(
      <TransactionsView showModal={false} setShowModal={() => undefined} />,
    );

    expect(html.match(/Service fees paid: ₱1000\.00/g) ?? []).toHaveLength(2);
    expect(html).not.toContain('Service fees paid: ₱0.00');
  });
});
