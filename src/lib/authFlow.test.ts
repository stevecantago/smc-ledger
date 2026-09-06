import { describe, expect, it } from 'vitest';
import {
  getRootAuthAction,
  getSecureLoginRequest,
  isPublicRegistrationEnabled,
  validateInvitationRequest,
} from './authFlow';

describe('getRootAuthAction', () => {
  it('redirects the root app to login when there is no confirmed session', () => {
    expect(getRootAuthAction({ isSupabaseConfigured: true, hasSession: false })).toBe('redirect_login');
  });

  it('shows the app only when Supabase is configured and a session exists', () => {
    expect(getRootAuthAction({ isSupabaseConfigured: true, hasSession: true })).toBe('show_app');
  });
});

describe('getSecureLoginRequest', () => {
  it('requires a password instead of falling back to magic link login', () => {
    expect(getSecureLoginRequest({ email: 'admin@example.com', password: '' })).toEqual({
      success: false,
      error: 'Password is required.',
    });
  });

  it('accepts email and password login credentials', () => {
    expect(getSecureLoginRequest({ email: 'admin@example.com', password: 'correct-horse' })).toEqual({
      success: true,
      email: 'admin@example.com',
      password: 'correct-horse',
    });
  });
});

describe('isPublicRegistrationEnabled', () => {
  it('keeps public registration disabled', () => {
    expect(isPublicRegistrationEnabled()).toBe(false);
  });
});

describe('validateInvitationRequest', () => {
  it('requires member invitations to include an email address', () => {
    expect(validateInvitationRequest({ displayName: 'Family Member', email: '', role: 'member' })).toEqual({
      success: false,
      error: 'Email address is required to invite a family member.',
    });
  });

  it('accepts a valid invitation payload', () => {
    expect(validateInvitationRequest({
      displayName: 'Family Member',
      email: ' member@example.com ',
      role: 'parent_member',
    })).toEqual({
      success: true,
      displayName: 'Family Member',
      email: 'member@example.com',
      role: 'parent_member',
    });
  });
});
