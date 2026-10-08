import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  CreditCardPaymentPreview,
  getCreditCardPaymentAmountError,
} from './TransactionsView';

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
});
