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
  return `${operation} saved locally, but Supabase sync failed: ${getErrorMessage(error)}`;
}
