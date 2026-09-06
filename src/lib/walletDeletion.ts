import { Transaction } from '../types/database';

type WalletDeleteBlockerResult = { success: true } | { success: false; error: string };

export function getWalletDeleteBlocker(walletId: string, transactions: Transaction[]): WalletDeleteBlockerResult {
  const linkedCount = transactions.filter(transaction =>
    transaction.wallet_id === walletId || transaction.destination_wallet_id === walletId
  ).length;

  if (linkedCount === 0) {
    return { success: true };
  }

  const noun = linkedCount === 1 ? 'transaction' : 'transactions';
  return {
    success: false,
    error: `This wallet has ${linkedCount} linked ${noun}. Clear or delete those transactions before deleting the wallet.`,
  };
}
