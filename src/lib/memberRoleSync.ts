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

const MEMBER_PROFILE_COLUMN_NAMES = ['first_name', 'last_name', 'date_of_birth'];

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

export function isMissingMemberProfileColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const supabaseError = error as SupabaseErrorLike;
  const message = getSupabaseErrorText(supabaseError);
  const mentionsProfileColumn = MEMBER_PROFILE_COLUMN_NAMES.some(columnName => message.includes(columnName));

  return (
    mentionsProfileColumn &&
    message.includes('household_members') &&
    (supabaseError.code === '42703' || supabaseError.code === 'PGRST204' || message.includes('could not find'))
  );
}

export function omitMemberRoleId<T extends { role_id?: unknown }>(payload: T): Omit<T, 'role_id'> {
  const { role_id: _roleId, ...legacyPayload } = payload;
  return legacyPayload;
}

export function omitMemberProfileFields<T extends { first_name?: unknown; last_name?: unknown; date_of_birth?: unknown }>(
  payload: T
): Omit<T, 'first_name' | 'last_name' | 'date_of_birth'> {
  const {
    first_name: _firstName,
    last_name: _lastName,
    date_of_birth: _dateOfBirth,
    ...legacyPayload
  } = payload;

  return legacyPayload;
}

export function omitUnsupportedMemberColumns<T extends {
  role_id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  date_of_birth?: unknown;
}>(
  payload: T
): Omit<T, 'role_id' | 'first_name' | 'last_name' | 'date_of_birth'> {
  const {
    role_id: _roleId,
    first_name: _firstName,
    last_name: _lastName,
    date_of_birth: _dateOfBirth,
    ...legacyPayload
  } = payload;

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

export async function retryMemberWriteWithSchemaFallbacks<
  TFull extends SupabaseResult,
  TWithoutRoleId extends SupabaseResult,
  TWithoutProfileFields extends SupabaseResult,
  TLegacy extends SupabaseResult,
>(
  writeFull: () => PromiseLike<TFull>,
  writeWithoutRoleId: () => PromiseLike<TWithoutRoleId>,
  writeWithoutProfileFields: () => PromiseLike<TWithoutProfileFields>,
  writeLegacy: () => PromiseLike<TLegacy>
): Promise<TFull | TWithoutRoleId | TWithoutProfileFields | TLegacy> {
  const result = await writeFull();

  if (isMissingMemberRoleIdColumnError(result.error)) {
    const withoutRoleIdResult = await writeWithoutRoleId();
    if (isMissingMemberProfileColumnError(withoutRoleIdResult.error)) {
      return writeLegacy();
    }
    return withoutRoleIdResult;
  }

  if (isMissingMemberProfileColumnError(result.error)) {
    const withoutProfileFieldsResult = await writeWithoutProfileFields();
    if (isMissingMemberRoleIdColumnError(withoutProfileFieldsResult.error)) {
      return writeLegacy();
    }
    return withoutProfileFieldsResult;
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
