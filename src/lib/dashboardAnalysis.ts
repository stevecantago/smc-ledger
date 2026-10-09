import type { Category, HouseholdMember, Transaction } from '../types/database';
import { fromPhpCentavos, toPhpCentavos } from './creditCardTransactions';

export const ANALYSIS_PERIODS = [
  ['today', 'Today'], ['this_week', 'This Week'], ['this_month', 'This Month'],
  ['last_month', 'Last Month'], ['this_year', 'This Year'], ['all_time', 'All Time'], ['custom', 'Custom'],
] as const;
export type AnalysisPeriod = typeof ANALYSIS_PERIODS[number][0];
export type AnalysisRange = { start: string; end: string };
export type AnalysisGroup = { id: string; label: string; amount: number; count: number; average: number };
export type DailyPoint = { date: string; income: number; expenses: number };

const DAY = 86400000;
const iso = (date: Date) => date.toISOString().slice(0, 10);

export function manilaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && iso(new Date(time)) === value;
}

export function getAnalysisRange(period: AnalysisPeriod, today: string, custom: AnalysisRange): AnalysisRange {
  const date = new Date(`${today}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  switch (period) {
    case 'today': return { start: today, end: today };
    case 'this_week': {
      const start = new Date(date.getTime() - ((date.getUTCDay() + 6) % 7) * DAY);
      return { start: iso(start), end: iso(new Date(start.getTime() + 6 * DAY)) };
    }
    case 'this_month': return { start: iso(new Date(Date.UTC(year, month, 1))), end: iso(new Date(Date.UTC(year, month + 1, 0))) };
    case 'last_month': return { start: iso(new Date(Date.UTC(year, month - 1, 1))), end: iso(new Date(Date.UTC(year, month, 0))) };
    case 'this_year': return { start: `${year}-01-01`, end: `${year}-12-31` };
    case 'all_time': return { start: '', end: '' };
    case 'custom': return custom;
  }
}

export function getAnalysisRangeError(range: AnalysisRange): string | null {
  if (range.start && !isCalendarDate(range.start) || range.end && !isCalendarDate(range.end)) return 'Enter valid calendar dates.';
  if (range.start && range.end && range.start > range.end) return 'The start date must be on or before the end date.';
  return null;
}

// Read-only analysis. Income stays gross; expenses include the existing transaction fee.
// Transfers and loan/card payments are excluded, matching the incumbent dashboard.
export function buildDashboardAnalysis(transactions: Transaction[], categories: Category[], members: HouseholdMember[], range: AnalysisRange) {
  const categoryNames = new Map(categories.map(category => [category.id, category.name]));
  const memberNames = new Map(members.map(member => [member.id, member.display_name]));
  const selected = getAnalysisRangeError(range) ? [] : transactions.filter(transaction =>
    isCalendarDate(transaction.transaction_date)
    && (!range.start || transaction.transaction_date >= range.start)
    && (!range.end || transaction.transaction_date <= range.end),
  );
  const expenseGroups = new Map<string, { label: string; cents: number; count: number }>();
  const memberGroups = new Map<string, { label: string; cents: number; count: number }>();
  const days = new Map<string, { income: number; expenses: number }>();
  let income = 0;
  let expenses = 0;
  for (const transaction of selected) {
    if (transaction.type !== 'income' && transaction.type !== 'expense') continue;
    const day = days.get(transaction.transaction_date) ?? { income: 0, expenses: 0 };
    if (transaction.type === 'income') {
      const cents = toPhpCentavos(transaction.amount);
      income += cents;
      day.income += cents;
    } else {
      const cents = toPhpCentavos(transaction.amount) + toPhpCentavos(transaction.fee ?? 0);
      expenses += cents;
      day.expenses += cents;
      const categoryId = transaction.category_id || 'uncategorized';
      const category = expenseGroups.get(categoryId) ?? { label: categoryNames.get(categoryId) ?? 'Uncategorized', cents: 0, count: 0 };
      category.cents += cents;
      category.count++;
      expenseGroups.set(categoryId, category);
      const memberId = transaction.payer_id || 'unassigned';
      const member = memberGroups.get(memberId) ?? { label: memberNames.get(memberId) ?? 'Unassigned member', cents: 0, count: 0 };
      member.cents += cents;
      member.count++;
      memberGroups.set(memberId, member);
    }
    days.set(transaction.transaction_date, day);
  }
  const groups = (values: typeof expenseGroups): AnalysisGroup[] => Array.from(values, ([id, value]) => ({
    id, label: value.label, amount: fromPhpCentavos(value.cents), count: value.count,
    average: fromPhpCentavos(Math.round(value.cents / value.count)),
  })).sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  const recordedDates = Array.from(days.keys()).sort();
  const start = range.start || recordedDates[0];
  const end = range.end || recordedDates[recordedDates.length - 1];
  const dates = new Set<string>();
  if (days.size && start && end && !getAnalysisRangeError(range)) {
    const first = Date.parse(`${start}T00:00:00Z`);
    const last = Date.parse(`${end}T00:00:00Z`);
    if ((last - first) / DAY <= 366) {
      for (let time = first; time <= last; time += DAY) dates.add(iso(new Date(time)));
    } else {
      // Long periods retain every recorded day and adjacent zero days without
      // allocating an unbounded calendar or interpolating across missing activity.
      dates.add(start); dates.add(end);
      for (const value of recordedDates) {
        dates.add(value);
        const time = Date.parse(`${value}T00:00:00Z`);
        if (time - DAY >= first) dates.add(iso(new Date(time - DAY)));
        if (time + DAY <= last) dates.add(iso(new Date(time + DAY)));
      }
    }
  }
  const daily: DailyPoint[] = Array.from(dates).sort().map(date => ({ date,
    income: fromPhpCentavos(days.get(date)?.income ?? 0), expenses: fromPhpCentavos(days.get(date)?.expenses ?? 0),
  }));
  return { income: fromPhpCentavos(income), expenses: fromPhpCentavos(expenses), daily,
    categories: groups(expenseGroups), members: groups(memberGroups),
    transactionCount: selected.filter(transaction => transaction.type === 'income' || transaction.type === 'expense').length,
  };
}
