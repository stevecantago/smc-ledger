'use client';

import React, { useEffect, useState } from 'react';
import { HouseholdMember } from '../../types/database';
import { FAMILY_AVATARS, getDefaultFamilyAvatar, MEMBER_AVATARS_CHANGED_EVENT, MemberAvatar, readMemberAvatars } from '../../lib/memberAvatars';
import { STORAGE_KEYS } from '../../lib/storageKeys';

export function ProfileAvatar({ member }: { member: HouseholdMember }) {
  const [savedAvatar, setSavedAvatar] = useState<MemberAvatar | undefined>();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setSavedAvatar(readMemberAvatars()[member.id]);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.memberAvatars || event.key === null) refresh();
    };
    refresh();
    window.addEventListener(MEMBER_AVATARS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(MEMBER_AVATARS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [member.id]);

  const avatar = savedAvatar ?? (member.avatar_url
    ? { type: 'photo' as const, value: member.avatar_url }
    : getDefaultFamilyAvatar(member.family_relationship));
  const initials = member.display_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?';

  if (avatar.type === 'photo' && avatar.value !== failedPhoto) {
    // Supports existing local data URLs and profile URLs without an image proxy.
    return <img src={avatar.value} alt="" className="h-full w-full rounded-xl object-cover" onError={() => setFailedPhoto(avatar.value)} />;
  }

  const preset = avatar.type === 'preset' ? FAMILY_AVATARS.find(option => option.value === avatar.value) : undefined;
  return <span aria-hidden="true" className={preset ? 'text-2xl' : 'text-sm font-bold'}>{preset?.emoji ?? initials}</span>;
}
