import { validatePasswordCredential } from './authProfile';

type ProfileUpdateResult =
  | { success: true; firstName: string; lastName: string; displayName: string; email: string; dateOfBirth: string | null }
  | { success: false; error: string };

type PasswordChangeResult =
  | { success: true; currentPassword: string; newPassword: string }
  | { success: false; error: string };

export function getProfileUpdateRequest(input: {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
}): ProfileUpdateResult {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim();
  const dateOfBirth = input.dateOfBirth.trim() || null;

  if (!firstName) {
    return { success: false, error: 'First name is required.' };
  }

  if (!lastName) {
    return { success: false, error: 'Last name is required.' };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: 'Enter a valid email address.' };
  }

  return {
    success: true,
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    email,
    dateOfBirth,
  };
}

export function getProfileNameFields(input: {
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
}): { firstName: string; lastName: string } {
  const firstName = input.firstName?.trim() || '';
  const lastName = input.lastName?.trim() || '';

  if (firstName || lastName) {
    return { firstName, lastName };
  }

  const visibleName = input.displayName.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const parts = visibleName.split(/\s+/u).filter(Boolean);

  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
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
