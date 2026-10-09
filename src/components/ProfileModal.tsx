'use client';

import React, { useEffect, useId, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, Lock, Mail, Save, User, X } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { supabase } from '../lib/supabase';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';
import { getPasswordChangeRequest, getProfileNameFields, getProfileUpdateRequest } from '../lib/profileSettings';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const profileId = useId();
  const { currentMember, updateMember } = useHousehold();
  const initialNameFields = getProfileNameFields({
    firstName: currentMember.first_name,
    lastName: currentMember.last_name,
    displayName: currentMember.display_name,
  });
  const [firstName, setFirstName] = useState(initialNameFields.firstName);
  const [lastName, setLastName] = useState(initialNameFields.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(currentMember.date_of_birth || '');
  const [email, setEmail] = useState(currentMember.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const nameFields = getProfileNameFields({
      firstName: currentMember.first_name,
      lastName: currentMember.last_name,
      displayName: currentMember.display_name,
    });
    setFirstName(nameFields.firstName);
    setLastName(nameFields.lastName);
    setDateOfBirth(currentMember.date_of_birth || '');
    setEmail(currentMember.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage(null);
  }, [currentMember.date_of_birth, currentMember.display_name, currentMember.email, currentMember.first_name, currentMember.last_name, isOpen]);

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setProfileLoading(true);

    try {
      const request = getProfileUpdateRequest({ firstName, lastName, email, dateOfBirth });
      if (!request.success) throw new Error(request.error);

      const emailChanged = request.email.toLowerCase() !== (currentMember.email || '').toLowerCase();
      if (emailChanged && supabase) {
        const { error } = await supabase.auth.updateUser({ email: request.email });
        if (error) throw error;
      }

      const result = updateMember(currentMember.id, {
        first_name: request.firstName,
        last_name: request.lastName,
        date_of_birth: request.dateOfBirth,
        display_name: request.displayName,
        email: request.email,
      });
      if (!result.success) throw new Error(result.error || 'Profile update failed.');

      setMessage({
        type: 'success',
        text: emailChanged
          ? 'Profile saved. Confirm the email change from your inbox before using the new email to sign in.'
          : 'Profile saved.',
      });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Profile update failed.' });
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setPasswordLoading(true);

    try {
      if (!supabase) {
        throw new Error('Password changes require Supabase authentication.');
      }

      if (!currentMember.email) {
        throw new Error('Your profile needs an email address before changing password.');
      }

      const request = getPasswordChangeRequest({ currentPassword, newPassword, confirmPassword });
      if (!request.success) throw new Error(request.error);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: currentMember.email,
        password: request.currentPassword,
      });
      if (signInError) {
        throw new Error('Current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({ password: request.newPassword });
      if (error) throw error;

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ type: 'success', text: 'Password updated.' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Password update failed.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose} titleId={`${profileId}-title`}>
      <div className="mb-5 flex items-start justify-between border-b border-brand-line pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-brand-sky p-3 text-brand-ink">
            <User className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id={`${profileId}-title`} className="text-xl font-bold text-brand-ink">Profile</h2>
            <p className="text-xs text-brand-muted">Manage your account details and password.</p>
          </div>
        </div>
        <Button
          tone="quiet"
          onClick={onClose}
          className="h-11 w-11 shrink-0 px-0"
          aria-label="Close profile"
          title="Close profile"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      {message && (
        <div role={message.type === 'error' ? 'alert' : 'status'} className={`mb-5 flex items-center gap-2 rounded-lg border p-3 text-xs ${
          message.type === 'success'
            ? 'border-[#C8DDB7] bg-brand-mint text-[#315722]'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span>{message.text}</span>
        </div>
      )}

      <form onSubmit={handleProfileSubmit} className="space-y-4">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-brand-ink">Account details</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${profileId}-firstName`} className="mb-1 block text-xs font-semibold text-brand-muted">First name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  type="text"
                  required
                  id={`${profileId}-firstName`}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={event => setFirstName(event.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${profileId}-lastName`} className="mb-1 block text-xs font-semibold text-brand-muted">Last name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  type="text"
                  required
                  id={`${profileId}-lastName`}
                  autoComplete="family-name"
                  value={lastName}
                  onChange={event => setLastName(event.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${profileId}-dateOfBirth`} className="mb-1 block text-xs font-semibold text-brand-muted">Date of birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  type="date"
                  id={`${profileId}-dateOfBirth`}
                  autoComplete="bday"
                  value={dateOfBirth}
                  onChange={event => setDateOfBirth(event.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>

            <div>
              <label htmlFor={`${profileId}-email`} className="mb-1 block text-xs font-semibold text-brand-muted">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-brand-muted" aria-hidden="true" />
                <input
                  type="email"
                  required
                  id={`${profileId}-email`}
                  autoComplete="email"
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white py-2.5 pl-10 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>
            </div>
          </div>
        </fieldset>

        <div className="flex justify-end border-b border-brand-line pb-5">
          <Button
            type="submit"
            tone="primary"
            disabled={profileLoading}
            aria-busy={profileLoading}
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{profileLoading ? 'Saving...' : 'Save profile'}</span>
          </Button>
        </div>
      </form>

      <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-brand-ink">
          <Lock className="h-4 w-4 text-brand-orange" aria-hidden="true" />
          <span>Change password</span>
        </h2>

        <div>
          <label htmlFor={`${profileId}-currentPassword`} className="mb-1 block text-xs font-semibold text-brand-ink">Current password</label>
          <input
            type="password"
            id={`${profileId}-currentPassword`}
            autoComplete="current-password"
            value={currentPassword}
            onChange={event => setCurrentPassword(event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${profileId}-newPassword`} className="mb-1 block text-xs font-semibold text-brand-ink">New password</label>
            <input
              type="password"
              minLength={6}
              id={`${profileId}-newPassword`}
              autoComplete="new-password"
              value={newPassword}
              onChange={event => setNewPassword(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
          <div>
            <label htmlFor={`${profileId}-confirmPassword`} className="mb-1 block text-xs font-semibold text-brand-ink">Confirm new password</label>
            <input
              type="password"
              minLength={6}
              id={`${profileId}-confirmPassword`}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="min-h-11 w-full min-w-0 rounded-xl border border-brand-line bg-white px-3 py-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            tone="secondary"
            disabled={passwordLoading}
            aria-busy={passwordLoading}
          >
            <Lock className="h-4 w-4" aria-hidden="true" />
            <span>{passwordLoading ? 'Updating...' : 'Update password'}</span>
          </Button>
        </div>
      </form>
    </Dialog>
  );
};
