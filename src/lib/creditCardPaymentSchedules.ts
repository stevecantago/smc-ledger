import { Wallet } from '../types/database';
import { getCreditCardUsedBalance } from './creditCardTransactions';

export interface CreditCardPaymentSchedule {
  id: string;
  walletId: string;
  walletName: string;
  amount: number;
  dueDate: string;
}

export interface CreditCardPaymentScheduleFilters {
  walletId?: string;
  fromDate?: string;
  toDate?: string;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getNextCreditCardPaymentDate(today: Date = new Date()): string {
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();

  if (day <= 5) return formatLocalDate(new Date(year, month, 5));
  if (day <= 20) return formatLocalDate(new Date(year, month, 20));
  return formatLocalDate(new Date(year, month + 1, 5));
}

export function buildCreditCardPaymentSchedules(
  wallets: Wallet[],
  today: Date = new Date(),
): CreditCardPaymentSchedule[] {
  const dueDate = getNextCreditCardPaymentDate(today);

  return wallets.flatMap(wallet => {
    if (wallet.wallet_type !== 'credit_card') return [];
    const amount = getCreditCardUsedBalance(wallet);
    if (amount <= 0) return [];

    return [{
      id: `credit-card-payment-${wallet.id}`,
      walletId: wallet.id,
      walletName: wallet.name,
      amount,
      dueDate,
    }];
  });
}

export function filterCreditCardPaymentSchedules(
  schedules: CreditCardPaymentSchedule[],
  filters: CreditCardPaymentScheduleFilters,
): CreditCardPaymentSchedule[] {
  return schedules.filter(schedule => {
    if (filters.walletId && filters.walletId !== 'all' && schedule.walletId !== filters.walletId) return false;
    if (filters.fromDate && schedule.dueDate < filters.fromDate) return false;
    if (filters.toDate && schedule.dueDate > filters.toDate) return false;
    return true;
  });
}
