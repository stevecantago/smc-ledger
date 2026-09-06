import { HouseholdMember } from '../types/database';

function getVisibleName(displayName: string): string {
  return displayName.replace(/\s*\([^)]*\)\s*$/u, '').trim();
}

export function getDisplayFirstName(displayName: string): string {
  const visibleName = getVisibleName(displayName);
  return visibleName.split(/\s+/u).filter(Boolean)[0] || 'there';
}

export function getFamilyHouseholdName(adminDisplayName: string): string {
  const visibleName = getVisibleName(adminDisplayName);
  const nameParts = visibleName.split(/\s+/u).filter(Boolean);
  const lastName = nameParts.at(-1);

  return lastName ? `${lastName} Family Household` : 'Family Household';
}

export function getHouseholdDisplayName(members: HouseholdMember[]): string {
  const adminMember = members.find(member => member.role === 'admin') || members[0];
  return getFamilyHouseholdName(adminMember?.display_name || '');
}
