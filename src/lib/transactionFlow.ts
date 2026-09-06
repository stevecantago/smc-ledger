import { TransactionType } from '../types/database';

type TransactionSubmissionAction = 'transaction' | 'loan_payment';

export function getTransactionSubmissionAction(input: {
  type: TransactionType;
  selectedLoanId?: string | null;
}): TransactionSubmissionAction {
  return input.type === 'loan' && input.selectedLoanId ? 'loan_payment' : 'transaction';
}
