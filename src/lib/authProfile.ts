import { HouseholdMember } from '../types/database';

type CredentialValidationResult = { success: true } | { success: false; error: string };

export function resolveAuthenticatedMember(
  members: HouseholdMember[],
  authenticatedEmail: string | null | undefined,
  authenticatedUserId?: string | null | undefined
): HouseholdMember | null {
  const normalizedUserId = authenticatedUserId?.trim();
  if (normalizedUserId) {
    const byUserId = members.find(member => member.user_id === normalizedUserId);
    if (byUserId) return byUserId;
  }

  const normalizedEmail = authenticatedEmail?.trim().toLowerCase();
  if (!normalizedEmail) return null;

  return members.find(member => member.email?.trim().toLowerCase() === normalizedEmail) ?? null;
}

export function validatePasswordCredential(password: string): CredentialValidationResult {
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  return { success: true };
}

export function linkMemberToAuthenticatedUser(
  member: HouseholdMember,
  authenticatedUserId: string | null | undefined
): HouseholdMember {
  const trimmedUserId = authenticatedUserId?.trim();
  if (!trimmedUserId || member.user_id === trimmedUserId) return member;

  return {
    ...member,
    user_id: trimmedUserId,
  };
}
