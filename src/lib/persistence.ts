export type SyncStatus = 'local_only' | 'pending' | 'synced' | 'failed';

export type MutationResult = {
  success: boolean;
  error?: string;
  syncStatus?: SyncStatus;
};

export function getSyncStatus(isSupabaseConfigured: boolean): SyncStatus {
  return isSupabaseConfigured ? 'pending' : 'local_only';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (typeof error === 'string' && error.trim()) return error;
  return 'Unknown error';
}

export function getSyncFailureWarning(operation: string, error: unknown): string {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();
  const roleTableMissing =
    (normalized.includes('role_permissions') || normalized.includes('household_roles')) &&
    (normalized.includes('schema cache') || normalized.includes('pgrst205') || normalized.includes('does not exist'));

  if (roleTableMissing) {
    return `${operation} saved locally, but Supabase cannot find the household role tables. Apply migrations 013_custom_role_permissions.sql and 017_repair_household_member_role_id.sql. If the tables already exist, expose public in the Supabase Data API and refresh PostgREST with: NOTIFY pgrst, 'reload schema'; Original error: ${message}`;
  }

  return `${operation} saved locally, but Supabase sync failed: ${message}`;
}
