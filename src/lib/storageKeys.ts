export const STORAGE_KEYS = {
  authenticatedEmail: 'smc_authenticated_email',
  members: 'smc_members',
  wallets: 'smc_wallets',
  categories: 'smc_categories',
  transactions: 'smc_transactions',
  goals: 'smc_goals',
  loans: 'smc_loans',
  recurring: 'smc_recurring',
  activityLogs: 'smc_activity_logs',
} as const;

export const AUTH_STORAGE_KEYS = [STORAGE_KEYS.authenticatedEmail] as const;

export const HOUSEHOLD_STORAGE_KEYS = [
  STORAGE_KEYS.members,
  STORAGE_KEYS.wallets,
  STORAGE_KEYS.categories,
  STORAGE_KEYS.transactions,
  STORAGE_KEYS.goals,
  STORAGE_KEYS.loans,
  STORAGE_KEYS.recurring,
  STORAGE_KEYS.activityLogs,
] as const;

type RemovableStorage = Pick<Storage, 'removeItem'>;

export function clearAuthStorage(storage: RemovableStorage): void {
  AUTH_STORAGE_KEYS.forEach(key => storage.removeItem(key));
}

export function clearHouseholdStorage(storage: RemovableStorage): void {
  HOUSEHOLD_STORAGE_KEYS.forEach(key => storage.removeItem(key));
}
