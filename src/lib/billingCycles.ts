export type LedgerCycleRange = {
  startDate: string;
  endDate: string;
};

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function range(start: Date, end: Date): LedgerCycleRange {
  return {
    startDate: formatLocalDate(start),
    endDate: formatLocalDate(end),
  };
}

export function getCurrentLedgerCycle(date: Date = new Date()): LedgerCycleRange {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day >= 5 && day <= 19) {
    return range(new Date(year, month, 5), new Date(year, month, 19));
  }

  if (day >= 20) {
    return range(new Date(year, month, 20), new Date(year, month + 1, 4));
  }

  return range(new Date(year, month - 1, 20), new Date(year, month, 4));
}

export function getNextLedgerCycle(current: LedgerCycleRange): LedgerCycleRange {
  const start = parseLocalDate(current.startDate) || new Date();
  const year = start.getFullYear();
  const month = start.getMonth();

  if (start.getDate() === 5) {
    return range(new Date(year, month, 20), new Date(year, month + 1, 4));
  }

  return range(new Date(year, month + 1, 5), new Date(year, month + 1, 19));
}

export function shouldResetCycleFilterOnDate(date: Date = new Date()): boolean {
  const day = date.getDate();
  return day === 5 || day === 20;
}

export function getInitialLedgerCycleFilter(
  date: Date = new Date(),
  savedRange?: LedgerCycleRange | null
): LedgerCycleRange {
  if (savedRange && !shouldResetCycleFilterOnDate(date)) {
    return savedRange;
  }

  return getCurrentLedgerCycle(date);
}
