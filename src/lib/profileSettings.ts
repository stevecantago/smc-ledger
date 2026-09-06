import { validatePasswordCredential } from './authProfile';

type ProfileUpdateResult =
  | { success: true; displayName: string; email: string }
  | { success: false; error: string };

type PasswordChangeResult =
  | { success: true; currentPassword: string; newPassword: string }
  | { success: false; error: string };

export function getProfileUpdateRequest(input: {
  displayName: string;
  email: string;
}): ProfileUpdateResult {
  const displayName = input.displayName.trim();
  const email = input.email.trim();

  if (!displayName) {
    return { success: false, error: 'Display name is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }

  return { success: true, displayName, email };
}

export function getPasswordChangeRequest(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): PasswordChangeResult {
  if (!input.currentPassword) {
    return { success: false, error: 'Current password is required.' };
  }

  const passwordValidation = validatePasswordCredential(input.newPassword);
  if (!passwordValidation.success) {
    return passwordValidation;
  }

  if (input.newPassword !== input.confirmPassword) {
    return { success: false, error: 'New passwords do not match.' };
  }

  return {
    success: true,
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  };
}
