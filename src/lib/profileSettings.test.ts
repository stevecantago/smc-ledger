import { describe, expect, it } from 'vitest';
import { getPasswordChangeRequest, getProfileUpdateRequest } from './profileSettings';

describe('profile settings validation', () => {
  it('requires a display name before saving profile details', () => {
    expect(getProfileUpdateRequest({ displayName: '   ', email: 'user@example.com' })).toEqual({
      success: false,
      error: 'Display name is required.',
    });
  });

  it('requires a valid email before saving profile details', () => {
    expect(getProfileUpdateRequest({ displayName: 'Steve', email: 'not-an-email' })).toEqual({
      success: false,
      error: 'Enter a valid email address.',
    });
  });

  it('returns trimmed profile values when details are valid', () => {
    expect(getProfileUpdateRequest({ displayName: '  Steve Cantago  ', email: '  steve@example.com  ' })).toEqual({
      success: true,
      displayName: 'Steve Cantago',
      email: 'steve@example.com',
    });
  });

  it('requires current password before changing password', () => {
    expect(getPasswordChangeRequest({ currentPassword: '', newPassword: 'new-password', confirmPassword: 'new-password' })).toEqual({
      success: false,
      error: 'Current password is required.',
    });
  });

  it('rejects mismatched new password confirmation', () => {
    expect(getPasswordChangeRequest({ currentPassword: 'old-password', newPassword: 'new-password', confirmPassword: 'different' })).toEqual({
      success: false,
      error: 'New passwords do not match.',
    });
  });
});
