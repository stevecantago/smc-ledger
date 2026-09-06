export const HOUSEHOLD_MEMBER_SELECT_WITH_ROLE_ID = 'id, role, role_id, household_id, email, user_id';
export const HOUSEHOLD_MEMBER_SELECT_LEGACY = 'id, role, household_id, email, user_id';

type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

type SupabaseResult<T = unknown> = {
  data?: T | null;
  error?: unknown;
};

export function getHouseholdMemberSelectColumns(includeRoleId = true): string {
  return includeRoleId ? HOUSEHOLD_MEMBER_SELECT_WITH_ROLE_ID : HOUSEHOLD_MEMBER_SELECT_LEGACY;
}

export function isMissingMemberRoleIdColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const supabaseError = error as SupabaseErrorLike;
  const message = getSupabaseErrorText(supabaseError);

  return (
    (supabaseError.code === '42703' || supabaseError.code === 'PGRST204' || message.includes('could not find')) &&
    message.includes('role_id') &&
    message.includes('household_members')
  );
}

export function isMissingCustomRoleSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const supabaseError = error as SupabaseErrorLike;
  const message = getSupabaseErrorText(supabaseError);
  const mentionsCustomRoleTable = message.includes('household_roles') || message.includes('role_permissions');

  return (
    mentionsCustomRoleTable &&
    (supabaseError.code === '42P01' || supabaseError.code === 'PGRST205' || message.includes('does not exist'))
  );
}

export function omitMemberRoleId<T extends { role_id?: unknown }>(payload: T): Omit<T, 'role_id'> {
  const { role_id: _roleId, ...legacyPayload } = payload;
  return legacyPayload;
}

export async function retryMemberWriteWithoutRoleId<TWith extends SupabaseResult, TWithout extends SupabaseResult>(
  writeWithRoleId: () => PromiseLike<TWith>,
  writeWithoutRoleId: () => PromiseLike<TWithout>
): Promise<TWith | TWithout> {
  const result = await writeWithRoleId();

  if (isMissingMemberRoleIdColumnError(result.error)) {
    return writeWithoutRoleId();
  }

  return result;
}

function getSupabaseErrorText(error: SupabaseErrorLike): string {
  return [
    error.message,
    error.details,
    error.hint,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
