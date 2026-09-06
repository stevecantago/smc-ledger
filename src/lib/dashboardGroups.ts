import { RecurringTransfer, Wallet, WalletType } from '../types/database';
import { getCreditCardAvailableCredit, getCreditCardUsedBalance } from './creditCardTransactions';
import { getWalletTypeLabel } from './walletTypes';

export type DashboardWalletGroupId = Exclude<WalletType, never>;
export type DashboardSummaryCardId = DashboardWalletGroupId | 'total_purchasing_power';

export interface DashboardWalletAccountSummary {
  id: string;
  name: string;
  typeLabel: string;
  isShared: boolean;
  balance: number;
  secondaryBalance?: number;
}

export interface DashboardWalletGroup {
  id: DashboardWalletGroupId;
  label: string;
  accounts: DashboardWalletAccountSummary[];
}

export interface ScheduleWalletGroup {
  wallet: Wallet | undefined;
  items: RecurringTransfer[];
  totalOutflow: number;
  availableBalance: number;
  hasSufficientFunds: boolean;
}

export interface DashboardSummaryColumns {
  left: DashboardSummaryCardId[];
  right: DashboardSummaryCardId[];
}

const WALLET_GROUP_ORDER: DashboardWalletGroupId[] = [
  'bank',
  'e_wallet',
  'e_wallet_savings',
  'cash',
  'credit_card',
];

const HIDDEN_DASHBOARD_CASH_WALLET_NAMES = new Set([
  'cash - maki',
  'cash - matti',
  'cash - maciej',
]);

export function isDashboardSummaryWallet(wallet: Wallet): boolean {
  if (wallet.wallet_type !== 'cash') return true;
  return !HIDDEN_DASHBOARD_CASH_WALLET_NAMES.has(wallet.name.trim().toLowerCase());
}

export function getDashboardSummaryWallets(wallets: Wallet[]): Wallet[] {
  return wallets.filter(isDashboardSummaryWallet);
}

export function buildDashboardWalletGroups(wallets: Wallet[]): DashboardWalletGroup[] {
  const summaryWallets = getDashboardSummaryWallets(wallets);

  return WALLET_GROUP_ORDER.map(id => ({
    id,
    label: id === 'credit_card' ? 'Available Credit Lines' : getWalletTypeLabel(id),
    accounts: summaryWallets
      .filter(wallet => wallet.wallet_type === id)
      .map(wallet => {
        if (wallet.wallet_type === 'credit_card') {
          return {
            id: wallet.id,
            name: wallet.name,
            typeLabel: getWalletTypeLabel(wallet.wallet_type),
            isShared: wallet.is_shared,
            balance: getCreditCardAvailableCredit(wallet),
            secondaryBalance: getCreditCardUsedBalance(wallet),
          };
        }

        return {
          id: wallet.id,
          name: wallet.name,
          typeLabel: getWalletTypeLabel(wallet.wallet_type),
          isShared: wallet.is_shared,
          balance: wallet.current_balance,
        };
      }),
  }));
}

export function buildDashboardSummaryColumns(): DashboardSummaryColumns {
  return {
    left: ['total_purchasing_power', 'bank', 'credit_card'],
    right: ['cash', 'e_wallet', 'e_wallet_savings'],
  };
}

export function buildScheduleWalletGroups(
  recurringTransfers: RecurringTransfer[],
  wallets: Wallet[],
): ScheduleWalletGroup[] {
  const groups = new Map<string, ScheduleWalletGroup>();

  recurringTransfers.forEach(rule => {
    const walletId = rule.source_wallet_id;
    if (!groups.has(walletId)) {
      const wallet = wallets.find(item => item.id === walletId);
      const availableBalance = wallet
        ? wallet.wallet_type === 'credit_card'
          ? getCreditCardAvailableCredit(wallet)
          : wallet.current_balance
        : 0;

      groups.set(walletId, {
        wallet,
        items: [],
        totalOutflow: 0,
        availableBalance,
        hasSufficientFunds: true,
      });
    }

    const group = groups.get(walletId)!;
    group.items.push(rule);
    group.totalOutflow += rule.amount;
    group.hasSufficientFunds = group.availableBalance >= group.totalOutflow;
  });

  return Array.from(groups.values());
}
