import { FamilyRelationship } from '../types/database';
import { STORAGE_KEYS } from './storageKeys';

export type MemberAvatar =
  | { type: 'preset'; value: string }
  | { type: 'photo'; value: string };

export const FAMILY_AVATARS = [
  { value: 'father', label: 'Father', emoji: '👨' },
  { value: 'mother', label: 'Mother', emoji: '👩' },
  { value: 'grandfather', label: 'Grandfather', emoji: '👴' },
  { value: 'grandmother', label: 'Grandmother', emoji: '👵' },
  { value: 'guardian', label: 'Guardian', emoji: '🧑' },
  { value: 'son', label: 'Son', emoji: '👦' },
  { value: 'daughter', label: 'Daughter', emoji: '👧' },
  { value: 'child', label: 'Child', emoji: '🧒' },
  { value: 'family', label: 'Family member', emoji: '🙂' },
] as const;

const PHOTO_DATA_URL_PATTERN = /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/]+=*$/i;
const MAX_PHOTO_DATA_URL_LENGTH = 180_000;

const isMemberAvatar = (value: unknown): value is MemberAvatar => {
  if (!value || typeof value !== 'object') return false;
  const avatar = value as Partial<MemberAvatar>;
  if (avatar.type === 'preset') {
    return typeof avatar.value === 'string' && FAMILY_AVATARS.some(option => option.value === avatar.value);
  }
  return avatar.type === 'photo'
    && typeof avatar.value === 'string'
    && avatar.value.length <= MAX_PHOTO_DATA_URL_LENGTH
    && PHOTO_DATA_URL_PATTERN.test(avatar.value);
};

export function getDefaultFamilyAvatar(relationship?: FamilyRelationship): MemberAvatar {
  const value = relationship === 'Father' ? 'father'
    : relationship === 'Mother' ? 'mother'
      : relationship === 'Grandfather' ? 'grandfather'
        : relationship === 'Grandmother' ? 'grandmother'
          : relationship === 'Guardian' ? 'guardian'
            : relationship === 'Son' || relationship === 'Nephew' || relationship === 'Grandson' ? 'son'
              : relationship === 'Daughter' || relationship === 'Niece' || relationship === 'Granddaughter' ? 'daughter'
                : 'family';
  return { type: 'preset', value };
}

export function readMemberAvatars(): Record<string, MemberAvatar> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = window.localStorage.getItem(STORAGE_KEYS.memberAvatars);
    if (!stored) return {};
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, MemberAvatar] => isMemberAvatar(entry[1])));
  } catch {
    return {};
  }
}

export function writeMemberAvatars(avatars: Record<string, MemberAvatar>): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(STORAGE_KEYS.memberAvatars, JSON.stringify(avatars));
    return true;
  } catch {
    return false;
  }
}

export function isAvatarPhotoWithinLimit(value: string): boolean {
  return value.length <= MAX_PHOTO_DATA_URL_LENGTH && PHOTO_DATA_URL_PATTERN.test(value);
}
