import { TransactionType, Wallet } from '../types/database';

type TransactionBalanceInput = {
  wallet_id: string;
  destination_wallet_id?: string | null;
  type: TransactionType;
  amount: number;
  fee?: number | null;
};

type BalanceResult =
  | { success: true; wallets: Wallet[]; changedWalletIds: string[] }
  | { success: false; error: string; wallets: Wallet[]; changedWalletIds: string[] };

function cloneWallets(wallets: Wallet[]): Wallet[] {
  return wallets.map(wallet => ({ ...wallet }));
}

function findWallet(wallets: Wallet[], id: string | null | undefined): Wallet | undefined {
  return id ? wallets.find(wallet => wallet.id === id) : undefined;
}

function normalizeMayaAccountName(name: string): string {
  return name.trim().toLowerCase().replace(/\s*-\s*steve$/, '');
}

export function getRequiredCreditCardFunding(
  cardWallet: Wallet | undefined,
  wallets: Wallet[],
): { locked: boolean; walletId: string | null } {
  const requiredCardNames = new Set(['maya credit', 'maya black', 'maya black card']);
  if (!cardWallet || !requiredCardNames.has(normalizeMayaAccountName(cardWallet.name))) {
    return { locked: false, walletId: null };
  }

  const fundingWallet = wallets.find(wallet => (
    wallet.owner_id === cardWallet.owner_id
    && normalizeMayaAccountName(wallet.name) === 'maya wallet'
    && wallet.wallet_type !== 'credit_card'
  ));

  return { locked: true, walletId: fundingWallet?.id || null };
}

export function getCreditCardUsedBalance(wallet: Wallet): number {
  return wallet.wallet_type === 'credit_card' ? Math.abs(wallet.current_balance) : wallet.current_balance;
}

export function getCreditCardAvailableCredit(wallet: Wallet): number {
  if (wallet.wallet_type !== 'credit_card') return wallet.current_balance;
  return Math.max(0, (wallet.credit_limit || 0) - getCreditCardUsedBalance(wallet));
}

export function normalizeCreditCardWalletBalance(wallet: Wallet): Wallet {
  return wallet.wallet_type === 'credit_card'
    ? { ...wallet, current_balance: getCreditCardUsedBalance(wallet) }
    : wallet;
}

function assertCreditChargeAllowed(wallet: Wallet, chargeAmount: number): string | null {
  if (wallet.wallet_type !== 'credit_card') return null;
  const creditLimit = wallet.credit_limit || 0;
  if (getCreditCardUsedBalance(wallet) + chargeAmount > creditLimit) {
    return 'Credit card charge exceeds available credit.';
  }
  return null;
}

function assertCreditPaymentAllowed(wallet: Wallet, paymentAmount: number): string | null {
  if (wallet.wallet_type !== 'credit_card') return null;
  if (paymentAmount > getCreditCardUsedBalance(wallet)) {
    return 'Credit card payment cannot exceed the used balance.';
  }
  return null;
}

function updateWalletBalance(wallets: Wallet[], walletId: string, nextBalance: number): Wallet[] {
  return wallets.map(wallet => wallet.id === walletId ? { ...wallet, current_balance: nextBalance } : wallet);
}

function ok(wallets: Wallet[], changedWalletIds: string[]): BalanceResult {
  return { success: true, wallets, changedWalletIds: Array.from(new Set(changedWalletIds)) };
}

function fail(error: string, wallets: Wallet[]): BalanceResult {
  return { success: false, error, wallets, changedWalletIds: [] };
}

export function applyTransactionBalanceChange(wallets: Wallet[], input: TransactionBalanceInput): BalanceResult {
  const normalizedWallets = wallets.map(normalizeCreditCardWalletBalance);
  const sourceWallet = findWallet(normalizedWallets, input.wallet_id);
  if (!sourceWallet) return fail('Source wallet not found', wallets);

  const feeAmount = input.fee || 0;
  const totalAmount = input.amount + feeAmount;
  let nextWallets = cloneWallets(normalizedWallets);

  if (input.type === 'loan' && input.destination_wallet_id) {
    const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
    if (!destinationWallet) return fail('Destination wallet not found', wallets);
    if (destinationWallet.wallet_type !== 'credit_card') {
      return fail('Credit card payment destination must be a credit card or credit line.', wallets);
    }
    if (sourceWallet.wallet_type === 'credit_card') {
      return fail('Credit card payments require a non-credit funding account.', wallets);
    }

    const destinationCreditError = assertCreditPaymentAllowed(destinationWallet, input.amount);
    if (destinationCreditError) return fail(destinationCreditError, wallets);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, sourceWallet.current_balance - totalAmount);
    nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, destinationWallet.current_balance - input.amount);
    return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
  }

  if (input.type === 'expense' || input.type === 'loan') {
    const creditError = assertCreditChargeAllowed(sourceWallet, totalAmount);
    if (creditError) return fail(creditError, wallets);

    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? sourceWallet.current_balance + totalAmount
      : sourceWallet.current_balance - totalAmount;

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (input.type === 'income') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? Math.max(0, sourceWallet.current_balance - Math.max(0, input.amount - feeAmount))
      : sourceWallet.current_balance + input.amount - feeAmount;

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (!input.destination_wallet_id) return fail('Destination wallet required for transfers', wallets);
  if (input.destination_wallet_id === input.wallet_id) return fail('Source and destination wallets cannot be the same.', wallets);

  const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
  if (!destinationWallet) return fail('Destination wallet not found', wallets);

  const sourceCreditError = assertCreditChargeAllowed(sourceWallet, totalAmount);
  if (sourceCreditError) return fail(sourceCreditError, wallets);

  const destinationCreditError = assertCreditPaymentAllowed(destinationWallet, input.amount);
  if (destinationCreditError) return fail(destinationCreditError, wallets);

  const nextSourceBalance = sourceWallet.wallet_type === 'credit_card'
    ? sourceWallet.current_balance + totalAmount
    : sourceWallet.current_balance - totalAmount;

  const nextDestinationBalance = destinationWallet.wallet_type === 'credit_card'
    ? destinationWallet.current_balance - input.amount
    : destinationWallet.current_balance + input.amount;

  nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextSourceBalance);
  nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, nextDestinationBalance);
  return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
}

export function reverseTransactionBalanceChange(wallets: Wallet[], input: TransactionBalanceInput): BalanceResult {
  const normalizedWallets = wallets.map(normalizeCreditCardWalletBalance);
  const sourceWallet = findWallet(normalizedWallets, input.wallet_id);
  if (!sourceWallet) return fail('Source wallet not found', wallets);

  const feeAmount = input.fee || 0;
  const totalAmount = input.amount + feeAmount;
  let nextWallets = cloneWallets(normalizedWallets);

  if (input.type === 'loan' && input.destination_wallet_id) {
    const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
    if (!destinationWallet) return fail('Destination wallet not found', wallets);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, sourceWallet.current_balance + totalAmount);
    nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, destinationWallet.current_balance + input.amount);
    return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
  }

  if (input.type === 'expense' || input.type === 'loan') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? Math.max(0, sourceWallet.current_balance - totalAmount)
      : sourceWallet.current_balance + totalAmount;

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (input.type === 'income') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? sourceWallet.current_balance + Math.max(0, input.amount - feeAmount)
      : sourceWallet.current_balance - (input.amount - feeAmount);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
  if (!destinationWallet) return fail('Destination wallet not found', wallets);

  const nextSourceBalance = sourceWallet.wallet_type === 'credit_card'
    ? Math.max(0, sourceWallet.current_balance - totalAmount)
    : sourceWallet.current_balance + totalAmount;

  const nextDestinationBalance = destinationWallet.wallet_type === 'credit_card'
    ? destinationWallet.current_balance + input.amount
    : destinationWallet.current_balance - input.amount;

  nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextSourceBalance);
  nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, nextDestinationBalance);
  return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
}
