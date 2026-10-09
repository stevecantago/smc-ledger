'use client';

import React, { useEffect, useState } from 'react';
import { useHousehold } from '../context/HouseholdContext';
import {
  Users, ShieldCheck, UserCheck, Plus, AlertTriangle, Edit2, Trash2, HeartHandshake, KeyRound, Mail, Lock, CheckCircle2, ImagePlus
} from 'lucide-react';
import { HouseholdRole, HouseholdMember, FamilyRelationship, FAMILY_RELATIONSHIPS } from '../types/database';
import { supabase } from '../lib/supabase';
import { getPasswordResetRedirectUrl } from '../lib/authRedirects';
import { RolePermissionsMatrix } from './RolePermissionsMatrix';
import { getEffectiveRoleId, getHouseholdRoleName } from '../lib/permissions';
import { Dialog } from './ui/Dialog';
import { FAMILY_AVATARS, getDefaultFamilyAvatar, isAvatarPhotoWithinLimit, MemberAvatar, readMemberAvatars, writeMemberAvatars } from '../lib/memberAvatars';

async function createAvatarPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP photo.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose a photo smaller than 8 MB.');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const loadedImage = new Image();
      loadedImage.onload = () => resolve(loadedImage);
      loadedImage.onerror = () => reject(new Error('This photo could not be opened.'));
      loadedImage.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('This photo has no readable image data.');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Photo editing is unavailable in this browser.');

    const side = Math.min(image.naturalWidth, image.naturalHeight);
    canvas.width = 256;
    canvas.height = 256;
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    const photo = canvas.toDataURL('image/jpeg', 0.82);
    if (!isAvatarPhotoWithinLimit(photo)) throw new Error('This photo is too large to save on this device.');
    return photo;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export const MembersView: React.FC = () => {
  const { 
    members, currentMember, isAdmin, customRoles, hasPermission, wallets, transactions,
    addMember, updateMember, deleteMember 
  } = useHousehold();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<HouseholdMember | null>(null);
  const [avatarMember, setAvatarMember] = useState<HouseholdMember | null>(null);
  const [memberAvatars, setMemberAvatars] = useState<Record<string, MemberAvatar>>({});
  const [avatarError, setAvatarError] = useState('');
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // Add Member State
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoleId, setNewRoleId] = useState('role-teen-dependent');
  const [newFamilyRelationship, setNewFamilyRelationship] = useState<FamilyRelationship>('Other');
  const [errorMsg, setErrorMsg] = useState('');

  // Edit Member State
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRoleId, setEditRoleId] = useState('role-teen-dependent');
  const [editFamilyRelationship, setEditFamilyRelationship] = useState<FamilyRelationship>('Other');

  // Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Admin Reset Email Status
  const [resetEmailMsg, setResetEmailMsg] = useState<{ memberId: string; text: string } | null>(null);

  useEffect(() => {
    setMemberAvatars(readMemberAvatars());
  }, []);

  const canManageMembers = hasPermission('manage_members');
  const canSendPasswordResets = hasPermission('send_password_resets');
  const selectedInviteRole = customRoles.find(role => role.id === newRoleId) || customRoles[0];

  const saveMemberAvatar = (memberId: string, avatar: MemberAvatar) => {
    const next = { ...memberAvatars, [memberId]: avatar };
    if (!writeMemberAvatars(next)) {
      setAvatarError('This avatar could not be saved on this device. Try a smaller photo or a preset avatar.');
      return;
    }
    setMemberAvatars(next);
    setAvatarMember(null);
    setAvatarError('');
  };

  const handleAvatarPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !avatarMember) return;
    setAvatarError('');
    try {
      saveMemberAvatar(avatarMember.id, { type: 'photo', value: await createAvatarPhoto(file) });
    } catch (error) {
      setAvatarError(error instanceof Error ? error.message : 'This photo could not be saved.');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!newDisplayName.trim()) {
      setErrorMsg('Please enter a display name for the member.');
      return;
    }

    if (!newEmail.trim()) {
      setErrorMsg('Please enter an email address so an invitation can be sent.');
      return;
    }

    if (!supabase) {
      setErrorMsg('Supabase is not configured. Invitations require a secure Supabase connection.');
      return;
    }

    setInviteLoading(true);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Please sign in again before inviting a family member.');
      }

      const response = await fetch('/api/invitations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          householdId: currentMember.household_id,
          displayName: newDisplayName.trim(),
          email: newEmail.trim(),
          role: selectedInviteRole?.base_role || 'member',
          roleId: selectedInviteRole?.id || null,
          familyRelationship: newFamilyRelationship,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Failed to send invitation.');
      }

      const invitedMember = payload.member as HouseholdMember;
      const result = addMember(
        invitedMember.display_name,
        invitedMember.role,
        invitedMember.email,
        invitedMember.user_id,
        {
          memberId: invitedMember.id,
          roleId: invitedMember.role_id || selectedInviteRole?.id || null,
          familyRelationship: newFamilyRelationship,
          syncToSupabase: false,
        }
      );
      if (!result.success) {
        throw new Error(result.error || 'Invitation was sent, but the local roster was not updated.');
      }

      // The invitation endpoint supports older household_members schemas. Persist the new
      // optional relationship separately so the invite still succeeds before its migration.
      updateMember(invitedMember.id, { family_relationship: newFamilyRelationship });

      setResetEmailMsg({
        memberId: invitedMember.id,
        text: `Invitation sent to ${invitedMember.email}!`,
      });
      setNewDisplayName('');
      setNewEmail('');
      setShowAddModal(false);
      setTimeout(() => setResetEmailMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!editingMember) return;

    const res = updateMember(editingMember.id, {
      display_name: editDisplayName.trim(),
      email: editEmail.trim() || undefined,
      role: customRoles.find(role => role.id === editRoleId)?.base_role || 'member',
      role_id: editRoleId,
      family_relationship: editFamilyRelationship,
    });

    if (!res.success) {
      setErrorMsg(res.error || 'Failed to update member.');
      return;
    }

    setEditingMember(null);
  };

  const handleDeleteMember = (member: HouseholdMember) => {
    if (!window.confirm(`Are you sure you want to remove ${member.display_name} from the household roster?`)) return;
    const res = deleteMember(member.id);
    if (!res.success) {
      alert(res.error);
    }
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setPasswordLoading(true);

    try {
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
      }

      setPasswordMsg({ type: 'success', text: 'Your password has been updated successfully!' });
      setTimeout(() => {
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePasswordModal(false);
        setPasswordMsg(null);
      }, 1500);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAdminSendResetEmail = async (member: HouseholdMember) => {
    if (!member.email) {
      alert(`Member ${member.display_name} does not have a registered email address.`);
      return;
    }

    if (!window.confirm(`Send password reset email to ${member.display_name} (${member.email})?`)) return;

    try {
      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(member.email, {
          redirectTo: getPasswordResetRedirectUrl(window.location.origin),
        });
        if (error) throw error;
      }

      setResetEmailMsg({
        memberId: member.id,
        text: `Reset email sent to ${member.email}!`,
      });

      setTimeout(() => setResetEmailMsg(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to send reset email.');
    }
  };

  const getRoleBadge = (member: HouseholdMember) => {
    const role = customRoles.find(item => item.id === getEffectiveRoleId(member));
    const RoleIcon = member.role === 'admin' ? ShieldCheck : member.role === 'parent_member' ? HeartHandshake : UserCheck;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-brand-sky px-2.5 py-1 text-xs font-semibold text-[#16445A]">
        <RoleIcon className="h-3.5 w-3.5" aria-hidden="true" /> {role ? getHouseholdRoleName(role) : 'Member'}
      </span>
    );
  };

  return (
    <section aria-labelledby="family-members-heading" className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-brand-line bg-brand-paper p-5 shadow-[var(--fam-shadow)] sm:flex-row sm:items-center">
        <div>
          <h2 id="family-members-heading" className="flex items-center gap-2 text-lg font-bold text-brand-ink">
            <Users className="h-5 w-5 text-brand-orange" aria-hidden="true" />
            <span>Family Members Management</span>
          </h2>
          <p className="mt-1 text-sm text-brand-muted">
            Manage family profiles, invitations, and account recovery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPasswordMsg(null);
              setNewPassword('');
              setConfirmPassword('');
              setShowChangePasswordModal(true);
            }}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-brand-line bg-white px-3.5 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
            title="Change your own logged-in password"
          >
            <KeyRound className="h-4 w-4 text-brand-orange" aria-hidden="true" />
            <span>Change My Password</span>
          </button>

          {canManageMembers && (
            <button
              onClick={() => {
                setErrorMsg('');
                setShowAddModal(true);
                setNewFamilyRelationship('Other');
              }}
              className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#AB4311] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Invite family member</span>
            </button>
          )}
        </div>
      </div>

      {/* Member Cards Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {members.map(m => {
          const ownedWallets = wallets.filter(w => w.owner_id === m.id);
          const memberTxCount = transactions.filter(t => t.payer_id === m.id).length;
          const isSelf = currentMember.id === m.id;
          const hasEmail = Boolean(m.email);
          const avatar = memberAvatars[m.id] || getDefaultFamilyAvatar(m.family_relationship);
          const avatarContent = avatar.type === 'photo'
            ? <img src={avatar.value} alt="" className="h-full w-full rounded-xl object-cover" />
            : FAMILY_AVATARS.find(option => option.value === avatar.value)?.emoji || m.display_name.charAt(0);
          const canChangeAvatar = canManageMembers || isSelf;

          return (
            <div 
              key={m.id} 
              className={`flex flex-col justify-between space-y-4 rounded-2xl border bg-brand-paper p-4 shadow-[var(--fam-shadow)] transition-colors ${
                isSelf ? 'border-brand-sky ring-1 ring-brand-sky' : 'border-brand-line hover:border-brand-muted'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    {canChangeAvatar ? (
                      <button
                        type="button"
                        onClick={() => { setAvatarError(''); setAvatarMember(m); }}
                        aria-label={`Choose avatar or photo for ${m.display_name}`}
                        title="Choose avatar or photo"
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-line bg-brand-sky text-2xl transition hover:border-brand-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                      >
                        {avatarContent}
                      </button>
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-line bg-brand-sky text-2xl" aria-hidden="true">
                        {avatarContent}
                      </div>
                    )}
                    <div>
                      <h3 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink">
                        <span>{m.display_name}</span>
                        {isSelf && (
                          <span className="rounded-full bg-brand-canvas px-2 py-0.5 text-[10px] font-semibold text-brand-muted">
                            YOU
                          </span>
                        )}
                      </h3>
                      <p className="mt-0.5 break-all text-xs text-brand-muted">{m.email || 'No email registered'}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">{getRoleBadge(m)}<span className="inline-flex items-center rounded-full bg-brand-mint px-2.5 py-1 text-xs font-semibold text-[#31522A]">{m.family_relationship || 'Others'}</span></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-brand-line pt-3 text-xs">
                  <div className="rounded-xl border border-brand-line bg-brand-canvas p-2.5">
                    <span className="text-[10px] font-semibold text-brand-muted">Owned wallets</span>
                    <p className="mt-0.5 font-bold text-brand-ink">{ownedWallets.length} accounts</p>
                  </div>
                  <div className="rounded-xl border border-brand-line bg-brand-canvas p-2.5">
                    <span className="text-[10px] font-semibold text-brand-muted">Transactions logged</span>
                    <p className="mt-0.5 font-bold text-[#168B63]">{memberTxCount} entries</p>
                  </div>
                </div>

                {/* Reset Email Notification Banner */}
                {resetEmailMsg?.memberId === m.id && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 p-2 text-[11px] text-emerald-900" role="status">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{resetEmailMsg.text}</span>
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-brand-line pt-3">
                {isSelf ? (
                  <button
                    onClick={() => {
                      setPasswordMsg(null);
                      setNewPassword('');
                      setConfirmPassword('');
                      setShowChangePasswordModal(true);
                    }}
                    className="flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                  >
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Change My Password</span>
                  </button>
                ) : (
                  canSendPasswordResets && hasEmail ? (
                    <button
                      onClick={() => handleAdminSendResetEmail(m)}
                      className="flex min-h-10 items-center gap-1 text-sm font-semibold text-[#16445A] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                      title="Send Password Reset Email to Member"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Send Reset Email</span>
                    </button>
                  ) : <span className="text-[11px] text-brand-muted">Member Profile</span>
                )}

                {/* Admin Edit / Delete Actions */}
                {canManageMembers && (
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => {
                        setErrorMsg('');
                        setEditingMember(m);
                        setEditDisplayName(m.display_name);
                        setEditEmail(m.email || '');
                        setEditRoleId(getEffectiveRoleId(m));
                        setEditFamilyRelationship(m.family_relationship || 'Other');
                      }}
                      title="Edit Member Profile & Role"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted transition-colors hover:bg-brand-sky hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                      aria-label={`Edit ${m.display_name}`}
                    >
                      <Edit2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteMember(m)}
                        title="Remove family member"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-brand-muted transition-colors hover:bg-rose-50 hover:text-rose-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                        aria-label={`Remove ${m.display_name}`}
                      >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <RolePermissionsMatrix />

      <Dialog
        open={Boolean(avatarMember)}
        onClose={() => { setAvatarMember(null); setAvatarError(''); }}
        titleId="family-avatar-title"
        className="max-w-lg"
      >
        <div className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 id="family-avatar-title" className="text-lg font-bold text-brand-ink">Choose a family avatar</h3>
              <p className="mt-1 text-sm text-brand-muted">{avatarMember?.display_name} can have a family avatar or a profile photo.</p>
            </div>
            <button type="button" onClick={() => { setAvatarMember(null); setAvatarError(''); }} className="min-h-10 min-w-10 rounded-lg text-brand-muted hover:bg-brand-canvas hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange" aria-label="Close avatar picker">×</button>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Family avatar choices">
            {FAMILY_AVATARS.map(option => {
              const selected = avatarMember && (memberAvatars[avatarMember.id] || getDefaultFamilyAvatar(avatarMember.family_relationship));
              const isSelected = selected?.type === 'preset' && selected.value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => avatarMember && saveMemberAvatar(avatarMember.id, { type: 'preset', value: option.value })}
                  aria-label={`Use ${option.label} avatar`}
                  aria-pressed={isSelected}
                  className={`flex min-h-[88px] flex-col items-center justify-center gap-1 rounded-xl border bg-white p-2 text-xs font-medium text-brand-ink transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${isSelected ? 'border-brand-orange bg-[#FFF4EC] ring-1 ring-brand-orange' : 'border-brand-line hover:border-brand-orange'}`}
                >
                  <span className="text-3xl leading-none" aria-hidden="true">{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-brand-line pt-4">
            <label htmlFor="family-avatar-photo" className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-brand-ink transition hover:bg-brand-canvas focus-within:ring-2 focus-within:ring-brand-orange">
              <ImagePlus className="h-4 w-4 text-brand-orange" aria-hidden="true" />
              Upload a profile photo
              <input id="family-avatar-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={handleAvatarPhotoChange} />
            </label>
            <p className="mt-2 text-xs text-brand-muted">Photo is cropped to a square and saved on this device.</p>
          </div>

          {avatarError && <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{avatarError}</p>}
        </div>
      </Dialog>

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-brand-line bg-brand-paper p-6 shadow-2xl">
            <h3 className="flex items-center gap-2 text-base font-bold text-brand-ink">
              <KeyRound className="h-5 w-5 text-brand-orange" aria-hidden="true" />
              <span>Change Your Password</span>
            </h3>

            {passwordMsg && (
              <div role="status" className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
                passwordMsg.type === 'success' 
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-rose-300 bg-rose-50 text-rose-900'
              }`}>
                {passwordMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-brand-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Minimum 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-xl border border-brand-line bg-white py-2.5 pl-9 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-brand-muted" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    placeholder="Re-type new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-xl border border-brand-line bg-white py-2.5 pl-9 pr-3 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-brand-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:bg-brand-canvas hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="min-h-10 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#AB4311] disabled:opacity-50"
                >
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-brand-line bg-brand-paper p-6 shadow-2xl">
            <h3 className="text-base font-bold text-brand-ink">Invite Family Member</h3>

            {errorMsg && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Grandma Betty, Chloe Miller"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="member@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm font-medium text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              <div>
                <label htmlFor="new-family-relationship" className="mb-1.5 block text-sm font-medium text-brand-ink">Family relationship</label>
                <select id="new-family-relationship" value={newFamilyRelationship} onChange={event => setNewFamilyRelationship(event.target.value as FamilyRelationship)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  {FAMILY_RELATIONSHIPS.map(relationship => <option key={relationship.value} value={relationship.value}>{relationship.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Assigned Household Role</label>
                <select
                  value={newRoleId}
                  onChange={(e) => setNewRoleId(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {customRoles.map(role => (
                    <option key={role.id} value={role.id}>{getHouseholdRoleName(role)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-brand-line pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:bg-brand-canvas hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="min-h-10 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#AB4311] disabled:opacity-50"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-ink/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-5 rounded-2xl border border-brand-line bg-brand-paper p-6 shadow-2xl">
            <h3 className="text-base font-bold text-brand-ink">Edit member: {editingMember.display_name}</h3>

            {errorMsg && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Display Name</label>
                <input
                  type="text"
                  required
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm font-medium text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                />
              </div>

              <div>
                <label htmlFor="edit-family-relationship" className="mb-1.5 block text-sm font-medium text-brand-ink">Family relationship</label>
                <select id="edit-family-relationship" value={editFamilyRelationship} onChange={event => setEditFamilyRelationship(event.target.value as FamilyRelationship)} className="min-h-11 w-full rounded-xl border border-brand-line bg-white px-3 text-sm text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange">
                  {FAMILY_RELATIONSHIPS.map(relationship => <option key={relationship.value} value={relationship.value}>{relationship.label}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-brand-ink">Assigned Household Role</label>
                <select
                  value={editRoleId}
                  onChange={(e) => setEditRoleId(e.target.value)}
                  className="w-full rounded-xl border border-brand-line bg-white p-2.5 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {customRoles.map(role => (
                    <option key={role.id} value={role.id}>{getHouseholdRoleName(role)}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-brand-line pt-4">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="min-h-10 rounded-lg px-4 py-2 text-sm font-semibold text-brand-muted transition-colors hover:bg-brand-canvas hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-10 rounded-xl bg-brand-orange px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#AB4311]"
                >
                  Save Member Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};
