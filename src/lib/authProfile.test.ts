import { describe, expect, it } from 'vitest';
import { linkMemberToAuthenticatedUser, resolveAuthenticatedMember, validatePasswordCredential } from './authProfile';
import { HouseholdMember } from '../types/database';

const members: HouseholdMember[] = [
  {
    id: 'member-admin',
    household_id: 'hh-101',
    user_id: 'user-admin',
    role: 'admin',
    display_name: 'Admin User',
    email: 'admin@example.com',
    created_at: '2026-09-06T00:00:00.000Z',
  },
  {
    id: 'member-child',
    household_id: 'hh-101',
    user_id: 'user-child',
    role: 'member',
    display_name: 'Child User',
    email: 'child@example.com',
    created_at: '2026-09-06T00:00:00.000Z',
  },
];

describe('resolveAuthenticatedMember', () => {
  it('returns the matching member for a confirmed authenticated email', () => {
    expect(resolveAuthenticatedMember(members, 'ADMIN@example.com')?.id).toBe('member-admin');
  });

  it('returns the matching member by Supabase user ID when email is changing', () => {
    expect(resolveAuthenticatedMember(members, 'old-email@example.com', 'user-admin')?.id).toBe('member-admin');
  });

  it('does not fall back to the first or admin member when the email is not authenticated', () => {
    expect(resolveAuthenticatedMember(members, null)).toBeNull();
  });

  it('does not fall back to the first or admin member when no member matches the authenticated email', () => {
    expect(resolveAuthenticatedMember(members, 'unknown@example.com')).toBeNull();
  });
});

describe('validatePasswordCredential', () => {
  it('rejects missing passwords instead of allowing a default password', () => {
    expect(validatePasswordCredential('').success).toBe(false);
  });

  it('accepts passwords that meet the minimum length', () => {
    expect(validatePasswordCredential('correct-horse').success).toBe(true);
  });
});

describe('linkMemberToAuthenticatedUser', () => {
  it('replaces placeholder user IDs with the real authenticated Supabase user ID', () => {
    const linked = linkMemberToAuthenticatedUser(
      {
        ...members[0],
        user_id: 'usr-steve-admin',
      },
      'a3c2fb80-5de9-4d72-a739-21f0e6f991c1'
    );

    expect(linked.user_id).toBe('a3c2fb80-5de9-4d72-a739-21f0e6f991c1');
  });

  it('keeps an existing real user ID when it already matches the session', () => {
    const linked = linkMemberToAuthenticatedUser(
      {
        ...members[0],
        user_id: 'a3c2fb80-5de9-4d72-a739-21f0e6f991c1',
      },
      'a3c2fb80-5de9-4d72-a739-21f0e6f991c1'
    );

    expect(linked).toEqual({
      ...members[0],
      user_id: 'a3c2fb80-5de9-4d72-a739-21f0e6f991c1',
    });
  });
});
