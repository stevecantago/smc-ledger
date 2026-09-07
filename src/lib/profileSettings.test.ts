import { describe, expect, it } from 'vitest';
import { getPasswordChangeRequest, getProfileNameFields, getProfileUpdateRequest } from './profileSettings';

describe('profile settings validation', () => {
  it('derives first and last name fields from an existing display name', () => {
    expect(getProfileNameFields({ displayName: 'Steve Cantago (Head Admin Parent)' })).toEqual({
      firstName: 'Steve',
      lastName: 'Cantago',
    });
  });

  it('requires a first name before saving profile details', () => {
    expect(getProfileUpdateRequest({ firstName: '   ', lastName: 'Cantago', email: 'user@example.com', dateOfBirth: '' })).toEqual({
      success: false,
      error: 'First name is required.',
    });
  });

  it('requires a last name before saving profile details', () => {
    expect(getProfileUpdateRequest({ firstName: 'Steve', lastName: '   ', email: 'user@example.com', dateOfBirth: '' })).toEqual({
      success: false,
      error: 'Last name is required.',
    });
  });

  it('requires a valid email before saving profile details', () => {
    expect(getProfileUpdateRequest({ firstName: 'Steve', lastName: 'Cantago', email: 'not-an-email', dateOfBirth: '' })).toEqual({
      success: false,
      error: 'Enter a valid email address.',
    });
  });

  it('returns trimmed profile values and derived display name when details are valid', () => {
    expect(getProfileUpdateRequest({
      firstName: '  Steve  ',
      lastName: '  Cantago  ',
      email: '  steve@example.com  ',
      dateOfBirth: '1990-01-31',
    })).toEqual({
      success: true,
      firstName: 'Steve',
      lastName: 'Cantago',
      displayName: 'Steve Cantago',
      email: 'steve@example.com',
      dateOfBirth: '1990-01-31',
    });
  });

  it('keeps date of birth empty when not provided', () => {
    expect(getProfileUpdateRequest({
      firstName: 'Steve',
      lastName: 'Cantago',
      email: 'steve@example.com',
      dateOfBirth: '',
    })).toEqual({
      success: true,
      firstName: 'Steve',
      lastName: 'Cantago',
      displayName: 'Steve Cantago',
      email: 'steve@example.com',
      dateOfBirth: null,
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
