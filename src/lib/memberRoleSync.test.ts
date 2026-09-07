import { describe, expect, it } from 'vitest';
import {
  getHouseholdMemberSelectColumns,
  isMissingCustomRoleSchemaError,
  isMissingMemberProfileColumnError,
  isMissingMemberRoleIdColumnError,
  omitMemberProfileFields,
  omitMemberRoleId,
  omitUnsupportedMemberColumns,
  retryMemberWriteWithSchemaFallbacks,
  retryMemberWriteWithoutRoleId,
} from './memberRoleSync';

describe('member role Supabase compatibility', () => {
  it('recognizes the production schema error for a missing household member role_id column', () => {
    expect(isMissingMemberRoleIdColumnError({
      code: '42703',
      message: 'column household_members.role_id does not exist',
    })).toBe(true);
  });

  it('recognizes missing custom role tables as a schema drift condition', () => {
    expect(isMissingCustomRoleSchemaError({
      code: '42P01',
      message: 'relation "public.role_permissions" does not exist',
    })).toBe(true);
  });

  it('recognizes missing profile columns as a schema drift condition', () => {
    expect(isMissingMemberProfileColumnError({
      code: 'PGRST204',
      message: "Could not find the 'first_name' column of 'household_members' in the schema cache",
    })).toBe(true);
  });

  it('builds a household member select list without role_id for older production schemas', () => {
    expect(getHouseholdMemberSelectColumns(false)).toBe('id, role, household_id, email, user_id');
  });

  it('removes role_id from member writes without changing the legacy role', () => {
    expect(omitMemberRoleId({
      id: 'member-new',
      household_id: 'hh-101',
      user_id: null,
      role: 'member',
      role_id: 'role-teen-dependent',
      display_name: 'Teen Member',
      email: 'teen@example.com',
      created_at: '2026-09-07T00:00:00.000Z',
    })).toEqual({
      id: 'member-new',
      household_id: 'hh-101',
      user_id: null,
      role: 'member',
      display_name: 'Teen Member',
      email: 'teen@example.com',
      created_at: '2026-09-07T00:00:00.000Z',
    });
  });

  it('removes profile fields from member writes while keeping display name and email', () => {
    expect(omitMemberProfileFields({
      id: 'member-new',
      first_name: 'Teen',
      last_name: 'Member',
      date_of_birth: '2010-01-31',
      display_name: 'Teen Member',
      email: 'teen@example.com',
    })).toEqual({
      id: 'member-new',
      display_name: 'Teen Member',
      email: 'teen@example.com',
    });
  });

  it('removes all optional member columns that older schemas may not have', () => {
    expect(omitUnsupportedMemberColumns({
      id: 'member-new',
      role_id: 'role-teen-dependent',
      first_name: 'Teen',
      last_name: 'Member',
      date_of_birth: '2010-01-31',
      display_name: 'Teen Member',
    })).toEqual({
      id: 'member-new',
      display_name: 'Teen Member',
    });
  });

  it('retries member writes without role_id when Supabase reports the column is missing', async () => {
    const calls: string[] = [];

    const result = await retryMemberWriteWithoutRoleId(
      async () => {
        calls.push('with-role-id');
        return {
          data: null,
          error: { code: '42703', message: 'column household_members.role_id does not exist' },
        };
      },
      async () => {
        calls.push('without-role-id');
        return {
          data: { id: 'member-new' },
          error: null,
        };
      }
    );

    expect(calls).toEqual(['with-role-id', 'without-role-id']);
    expect(result).toEqual({ data: { id: 'member-new' }, error: null });
  });

  it('retries member writes without profile fields when Supabase reports those columns are missing', async () => {
    const calls: string[] = [];

    const result = await retryMemberWriteWithSchemaFallbacks(
      async () => {
        calls.push('full');
        return {
          data: null,
          error: { code: 'PGRST204', message: "Could not find the 'date_of_birth' column of 'household_members' in the schema cache" },
        };
      },
      async () => {
        calls.push('without-role-id');
        return { data: null, error: null };
      },
      async () => {
        calls.push('without-profile-fields');
        return {
          data: { id: 'member-new' },
          error: null,
        };
      },
      async () => {
        calls.push('legacy');
        return { data: null, error: null };
      }
    );

    expect(calls).toEqual(['full', 'without-profile-fields']);
    expect(result).toEqual({ data: { id: 'member-new' }, error: null });
  });
});
