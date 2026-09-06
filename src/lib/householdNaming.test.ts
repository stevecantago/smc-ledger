import { describe, expect, it } from 'vitest';
import {
  getDisplayFirstName,
  getFamilyHouseholdName,
  getHouseholdDisplayName,
} from './householdNaming';
import { HouseholdMember } from '../types/database';

const adminMember: HouseholdMember = {
  id: 'member-steve-admin',
  household_id: 'hh-101',
  user_id: null,
  role: 'admin',
  role_id: 'role-admin-head-parent',
  display_name: 'Steve Cantago (Head Admin Parent)',
  email: 'steve.cantago@gmail.com',
  created_at: '2026-09-07T00:00:00.000Z',
};

describe('household naming', () => {
  it('uses only the first visible name in the dashboard greeting', () => {
    expect(getDisplayFirstName('Steve Cantago (Head Admin Parent)')).toBe('Steve');
  });

  it('builds the household name from the admin last name', () => {
    expect(getFamilyHouseholdName('Steve Cantago (Head Admin Parent)')).toBe('Cantago Family Household');
  });

  it('uses the admin member when deriving the household display name', () => {
    expect(getHouseholdDisplayName([
      { ...adminMember, role: 'member', display_name: 'Maki Cantago' },
      adminMember,
    ])).toBe('Cantago Family Household');
  });
});
