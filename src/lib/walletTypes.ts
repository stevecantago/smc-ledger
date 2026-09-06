import { Wallet, WalletType } from '../types/database';
import { getCreditCardAvailableCredit, getCreditCardUsedBalance } from './creditCardTransactions';

export const WALLET_TYPE_OPTIONS: { value: WalletType; label: string }[] = [
  { value: 'bank', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card / Credit Line' },
  { value: 'e_wallet', label: 'E Wallet' },
  { value: 'e_wallet_savings', label: 'E Wallet (Savings)' },
  { value: 'cash', label: 'Physical Cash' },
];

export function getWalletTypeLabel(type: WalletType): string {
  return WALLET_TYPE_OPTIONS.find(option => option.value === type)?.label || type.replace(/_/g, ' ');
}

export function getWalletTypeSummary(wallets: Wallet[]) {
  const bankWallets = wallets.filter(wallet => wallet.wallet_type === 'bank');
  const eWallets = wallets.filter(wallet => wallet.wallet_type === 'e_wallet');
  const eWalletSavings = wallets.filter(wallet => wallet.wallet_type === 'e_wallet_savings');
  const cashWallets = wallets.filter(wallet => wallet.wallet_type === 'cash');
  const creditCards = wallets.filter(wallet => wallet.wallet_type === 'credit_card');

  return {
    bankBalance: bankWallets.reduce((sum, wallet) => sum + wallet.current_balance, 0),
    bankCount: bankWallets.length,
    eWalletBalance: eWallets.reduce((sum, wallet) => sum + wallet.current_balance, 0),
    eWalletCount: eWallets.length,
    eWalletSavingsBalance: eWalletSavings.reduce((sum, wallet) => sum + wallet.current_balance, 0),
    eWalletSavingsCount: eWalletSavings.length,
    cashBalance: cashWallets.reduce((sum, wallet) => sum + wallet.current_balance, 0),
    cashCount: cashWallets.length,
    availableCredit: creditCards.reduce((sum, wallet) => sum + getCreditCardAvailableCredit(wallet), 0),
    creditLimit: creditCards.reduce((sum, wallet) => sum + (wallet.credit_limit || 0), 0),
    usedCredit: creditCards.reduce((sum, wallet) => sum + getCreditCardUsedBalance(wallet), 0),
    creditCardCount: creditCards.length,
  };
}
