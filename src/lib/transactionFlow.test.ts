import { describe, expect, it } from 'vitest';
import { getTransactionSubmissionAction } from './transactionFlow';

describe('getTransactionSubmissionAction', () => {
  it('routes loan payments to the dedicated loan payment action to avoid duplicate ledger entries', () => {
    expect(getTransactionSubmissionAction({ type: 'loan', selectedLoanId: 'loan-1' })).toBe('loan_payment');
  });

  it('routes normal expense, income, and transfer entries through the transaction action', () => {
    expect(getTransactionSubmissionAction({ type: 'expense', selectedLoanId: null })).toBe('transaction');
    expect(getTransactionSubmissionAction({ type: 'income', selectedLoanId: null })).toBe('transaction');
    expect(getTransactionSubmissionAction({ type: 'transfer', selectedLoanId: null })).toBe('transaction');
  });
});
