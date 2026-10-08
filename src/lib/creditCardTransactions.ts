import { TransactionType, Wallet } from '../types/database';

type TransactionBalanceInput = {
  wallet_id: string;
  destination_wallet_id?: string | null;
  type: TransactionType;
  amount: number;
  fee?: number | null;
  service_fee_amount?: number | null;
};

export interface CreditCardPaymentAllocation {
  serviceFeePaid: number;
  usedBalancePaid: number;
  remainingServiceFees: number;
  remainingUsedBalance: number;
}

const CENTAVOS_PER_PHP = 100;

export function toPhpCentavos(value: number): number {
  if (!Number.isFinite(value)) return value;
  const scaled = value * CENTAVOS_PER_PHP;
  const roundingGuard = Math.sign(scaled) * Number.EPSILON * Math.abs(scaled);
  return Math.round(scaled + roundingGuard);
}

export function fromPhpCentavos(value: number): number {
  return value / CENTAVOS_PER_PHP;
}

export function addPhpAmounts(...values: number[]): number {
  return fromPhpCentavos(values.reduce((sum, value) => sum + toPhpCentavos(value), 0));
}

export function isPhpAmountGreaterThan(left: number, right: number): boolean {
  return toPhpCentavos(left) > toPhpCentavos(right);
}

function normalizePhpAmount(value: number): number {
  return fromPhpCentavos(toPhpCentavos(value));
}

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
  return wallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(Math.abs(toPhpCentavos(wallet.current_balance)))
    : normalizePhpAmount(wallet.current_balance);
}

export function getCreditCardServiceFeeBalance(wallet: Wallet): number {
  return wallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(Math.max(0, toPhpCentavos(wallet.service_fee_balance || 0)))
    : 0;
}

export function getCreditCardTotalDue(wallet: Wallet): number {
  if (wallet.wallet_type !== 'credit_card') return 0;
  return addPhpAmounts(getCreditCardUsedBalance(wallet), getCreditCardServiceFeeBalance(wallet));
}

export function getCreditCardPaymentAllocation(
  wallet: Wallet,
  paymentAmount: number,
): CreditCardPaymentAllocation {
  const serviceFees = toPhpCentavos(getCreditCardServiceFeeBalance(wallet));
  const usedBalance = toPhpCentavos(getCreditCardUsedBalance(wallet));
  const payment = Math.max(0, toPhpCentavos(paymentAmount));
  const serviceFeePaid = Math.min(payment, serviceFees);
  const usedBalancePaid = Math.min(Math.max(payment - serviceFeePaid, 0), usedBalance);

  return {
    serviceFeePaid: fromPhpCentavos(serviceFeePaid),
    usedBalancePaid: fromPhpCentavos(usedBalancePaid),
    remainingServiceFees: fromPhpCentavos(serviceFees - serviceFeePaid),
    remainingUsedBalance: fromPhpCentavos(usedBalance - usedBalancePaid),
  };
}

export function getCreditCardAvailableCredit(wallet: Wallet): number {
  if (wallet.wallet_type !== 'credit_card') return wallet.current_balance;
  return fromPhpCentavos(Math.max(
    0,
    toPhpCentavos(wallet.credit_limit || 0) - toPhpCentavos(getCreditCardTotalDue(wallet)),
  ));
}

export function normalizeCreditCardWalletBalance(wallet: Wallet): Wallet {
  return wallet.wallet_type === 'credit_card'
    ? {
        ...wallet,
        current_balance: getCreditCardUsedBalance(wallet),
        service_fee_balance: getCreditCardServiceFeeBalance(wallet),
      }
    : wallet;
}

function assertCreditChargeAllowed(wallet: Wallet, chargeAmount: number): string | null {
  if (wallet.wallet_type !== 'credit_card') return null;
  const creditLimit = wallet.credit_limit || 0;
  if (toPhpCentavos(getCreditCardTotalDue(wallet)) + toPhpCentavos(chargeAmount) > toPhpCentavos(creditLimit)) {
    return 'Credit card charge exceeds available credit.';
  }
  return null;
}

function assertCreditPaymentAllowed(wallet: Wallet, paymentAmount: number): string | null {
  if (wallet.wallet_type !== 'credit_card') return null;
  if (isPhpAmountGreaterThan(paymentAmount, getCreditCardUsedBalance(wallet))) {
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

  const amountCentavos = toPhpCentavos(input.amount);
  const feeCentavos = toPhpCentavos(input.fee || 0);
  const totalCentavos = amountCentavos + feeCentavos;
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

    if (amountCentavos > toPhpCentavos(getCreditCardTotalDue(destinationWallet))) {
      return fail('Credit card payment cannot exceed total due.', wallets);
    }

    const allocation = getCreditCardPaymentAllocation(destinationWallet, input.amount);

    nextWallets = updateWalletBalance(
      nextWallets,
      sourceWallet.id,
      fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) - totalCentavos),
    );
    nextWallets = nextWallets.map(wallet => wallet.id === destinationWallet.id
      ? {
          ...wallet,
          current_balance: allocation.remainingUsedBalance,
          service_fee_balance: allocation.remainingServiceFees,
        }
      : wallet);
    return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
  }

  if (input.type === 'expense' || input.type === 'loan') {
    const creditError = assertCreditChargeAllowed(sourceWallet, fromPhpCentavos(totalCentavos));
    if (creditError) return fail(creditError, wallets);

    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + totalCentavos)
      : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) - totalCentavos);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (input.type === 'income') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? fromPhpCentavos(Math.max(0, toPhpCentavos(sourceWallet.current_balance) - Math.max(0, amountCentavos - feeCentavos)))
      : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + amountCentavos - feeCentavos);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (!input.destination_wallet_id) return fail('Destination wallet required for transfers', wallets);
  if (input.destination_wallet_id === input.wallet_id) return fail('Source and destination wallets cannot be the same.', wallets);

  const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
  if (!destinationWallet) return fail('Destination wallet not found', wallets);

  const sourceCreditError = assertCreditChargeAllowed(sourceWallet, fromPhpCentavos(totalCentavos));
  if (sourceCreditError) return fail(sourceCreditError, wallets);

  const destinationCreditError = assertCreditPaymentAllowed(destinationWallet, input.amount);
  if (destinationCreditError) return fail(destinationCreditError, wallets);

  const nextSourceBalance = sourceWallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + totalCentavos)
    : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) - totalCentavos);

  const nextDestinationBalance = destinationWallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(toPhpCentavos(destinationWallet.current_balance) - amountCentavos)
    : fromPhpCentavos(toPhpCentavos(destinationWallet.current_balance) + amountCentavos);

  nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextSourceBalance);
  nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, nextDestinationBalance);
  return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
}

export function reverseTransactionBalanceChange(wallets: Wallet[], input: TransactionBalanceInput): BalanceResult {
  const normalizedWallets = wallets.map(normalizeCreditCardWalletBalance);
  const sourceWallet = findWallet(normalizedWallets, input.wallet_id);
  if (!sourceWallet) return fail('Source wallet not found', wallets);

  const amountCentavos = toPhpCentavos(input.amount);
  const feeCentavos = toPhpCentavos(input.fee || 0);
  const totalCentavos = amountCentavos + feeCentavos;
  let nextWallets = cloneWallets(normalizedWallets);

  if (input.type === 'loan' && input.destination_wallet_id) {
    const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
    if (!destinationWallet) return fail('Destination wallet not found', wallets);

    nextWallets = updateWalletBalance(
      nextWallets,
      sourceWallet.id,
      fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + totalCentavos),
    );
    const serviceFeeCentavos = toPhpCentavos(input.service_fee_amount || 0);
    nextWallets = nextWallets.map(wallet => wallet.id === destinationWallet.id
      ? {
          ...wallet,
          current_balance: fromPhpCentavos(
            toPhpCentavos(wallet.current_balance) + amountCentavos - serviceFeeCentavos,
          ),
          service_fee_balance: fromPhpCentavos(
            toPhpCentavos(getCreditCardServiceFeeBalance(wallet)) + serviceFeeCentavos,
          ),
        }
      : wallet);
    return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
  }

  if (input.type === 'expense' || input.type === 'loan') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? fromPhpCentavos(Math.max(0, toPhpCentavos(sourceWallet.current_balance) - totalCentavos))
      : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + totalCentavos);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  if (input.type === 'income') {
    const nextBalance = sourceWallet.wallet_type === 'credit_card'
      ? fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + Math.max(0, amountCentavos - feeCentavos))
      : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) - amountCentavos + feeCentavos);

    nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextBalance);
    return ok(nextWallets, [sourceWallet.id]);
  }

  const destinationWallet = findWallet(normalizedWallets, input.destination_wallet_id);
  if (!destinationWallet) return fail('Destination wallet not found', wallets);

  const nextSourceBalance = sourceWallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(Math.max(0, toPhpCentavos(sourceWallet.current_balance) - totalCentavos))
    : fromPhpCentavos(toPhpCentavos(sourceWallet.current_balance) + totalCentavos);

  const nextDestinationBalance = destinationWallet.wallet_type === 'credit_card'
    ? fromPhpCentavos(toPhpCentavos(destinationWallet.current_balance) + amountCentavos)
    : fromPhpCentavos(toPhpCentavos(destinationWallet.current_balance) - amountCentavos);

  nextWallets = updateWalletBalance(nextWallets, sourceWallet.id, nextSourceBalance);
  nextWallets = updateWalletBalance(nextWallets, destinationWallet.id, nextDestinationBalance);
  return ok(nextWallets, [sourceWallet.id, destinationWallet.id]);
}
