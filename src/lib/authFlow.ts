import { HouseholdRole } from '../types/database';
import { validatePasswordCredential } from './authProfile';

export type RootAuthAction = 'redirect_login' | 'show_app';

export function getRootAuthAction(input: {
  isSupabaseConfigured: boolean;
  hasSession: boolean;
}): RootAuthAction {
  return input.isSupabaseConfigured && input.hasSession ? 'show_app' : 'redirect_login';
}

export function getSecureLoginRequest(input: {
  email: string;
  password: string;
}): { success: true; email: string; password: string } | { success: false; error: string } {
  const email = input.email.trim();
  if (!email) {
    return { success: false, error: 'Email address is required.' };
  }

  const passwordValidation = validatePasswordCredential(input.password);
  if (!passwordValidation.success) {
    return passwordValidation;
  }

  return {
    success: true,
    email,
    password: input.password,
  };
}

export function isPublicRegistrationEnabled(): boolean {
  return false;
}

export function validateInvitationRequest(input: {
  displayName: string;
  email: string;
  role: HouseholdRole;
}): { success: true; displayName: string; email: string; role: HouseholdRole } | { success: false; error: string } {
  const displayName = input.displayName.trim();
  const email = input.email.trim();

  if (!displayName) {
    return { success: false, error: 'Display name is required.' };
  }

  if (!email) {
    return { success: false, error: 'Email address is required to invite a family member.' };
  }

  if (!['admin', 'parent_member', 'member'].includes(input.role)) {
    return { success: false, error: 'Invalid household role.' };
  }

  return {
    success: true,
    displayName,
    email,
    role: input.role,
  };
}
