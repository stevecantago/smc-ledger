'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Lock, Mail, Save, User, X } from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { supabase } from '../lib/supabase';
import { getPasswordChangeRequest, getProfileUpdateRequest } from '../lib/profileSettings';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentMember, updateMember } = useHousehold();
  const [displayName, setDisplayName] = useState(currentMember.display_name);
  const [email, setEmail] = useState(currentMember.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(currentMember.display_name);
    setEmail(currentMember.email || '');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setMessage(null);
  }, [currentMember.display_name, currentMember.email, isOpen]);

  if (!isOpen) return null;

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setProfileLoading(true);

    try {
      const request = getProfileUpdateRequest({ displayName, email });
      if (!request.success) throw new Error(request.error);

      const emailChanged = request.email.toLowerCase() !== (currentMember.email || '').toLowerCase();
      if (emailChanged && supabase) {
        const { error } = await supabase.auth.updateUser({ email: request.email });
        if (error) throw error;
      }

      const result = updateMember(currentMember.id, {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-sky-500/20 bg-sky-500/10 p-2 text-sky-400">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Profile</h3>
              <p className="text-xs text-slate-400">Manage your account details and password.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close profile"
            title="Close profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {message && (
          <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-xs ${
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Display name</label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={displayName}
                onChange={event => setDisplayName(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-9 pr-3 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end border-b border-slate-800 pb-5">
            <button
              type="submit"
              disabled={profileLoading}
              className="flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow transition-colors hover:bg-sky-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{profileLoading ? 'Saving...' : 'Save profile'}</span>
            </button>
          </div>
        </form>

        <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Lock className="h-4 w-4 text-amber-400" />
            <span>Change password</span>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-300">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={event => setCurrentPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">New password</label>
              <input
                type="password"
                minLength={6}
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Confirm new password</label>
              <input
                type="password"
                minLength={6}
                value={confirmPassword}
                onChange={event => setConfirmPassword(event.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={passwordLoading}
              className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-200 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              <span>{passwordLoading ? 'Updating...' : 'Update password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
