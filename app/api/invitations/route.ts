import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateInvitationRequest } from '../../../src/lib/authFlow';
import { getPasswordResetRedirectUrl } from '../../../src/lib/authRedirects';
import type { HouseholdMember, HouseholdRole } from '../../../src/types/database';
import { getEffectiveRoleId } from '../../../src/lib/permissions';
import {
  getHouseholdMemberSelectColumns,
  isMissingCustomRoleSchemaError,
  isMissingMemberRoleIdColumnError,
  omitMemberRoleId,
  retryMemberWriteWithoutRoleId,
} from '../../../src/lib/memberRoleSync';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function hasLegacyInvitePermission(member: Pick<HouseholdMember, 'role'>): boolean {
  return member.role === 'admin' || member.role === 'parent_member';
}

export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonError('Supabase invitation service is not configured.', 500);
  }

  const token = getBearerToken(request);
  if (!token) {
    return jsonError('You must be signed in to invite family members.', 401);
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonError('Your sign-in session could not be verified.', 401);
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid invitation request.', 400);
  }
  const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
  if (!householdId) {
    return jsonError('Household ID is required.', 400);
  }

  let memberRoleIdColumnAvailable = true;
  let adminLookupByUserId = await adminClient
    .from('household_members')
    .select(getHouseholdMemberSelectColumns(true))
    .eq('household_id', householdId)
    .eq('user_id', userData.user.id);

  if (isMissingMemberRoleIdColumnError(adminLookupByUserId.error)) {
    memberRoleIdColumnAvailable = false;
    adminLookupByUserId = await adminClient
      .from('household_members')
      .select(getHouseholdMemberSelectColumns(false))
      .eq('household_id', householdId)
      .eq('user_id', userData.user.id);
  }

  if (adminLookupByUserId.error) {
    return jsonError(adminLookupByUserId.error.message, 500);
  }

  let adminMembership = adminLookupByUserId.data?.[0] ?? null;

  if (!adminMembership && userData.user.email) {
    let adminLookupByEmail = await adminClient
      .from('household_members')
      .select(getHouseholdMemberSelectColumns(memberRoleIdColumnAvailable))
      .eq('household_id', householdId)
      .is('user_id', null)
      .ilike('email', userData.user.email);

    if (isMissingMemberRoleIdColumnError(adminLookupByEmail.error)) {
      memberRoleIdColumnAvailable = false;
      adminLookupByEmail = await adminClient
        .from('household_members')
        .select(getHouseholdMemberSelectColumns(false))
        .eq('household_id', householdId)
        .is('user_id', null)
        .ilike('email', userData.user.email);
    }

    if (adminLookupByEmail.error) {
      return jsonError(adminLookupByEmail.error.message, 500);
    }

    adminMembership = adminLookupByEmail.data?.[0] ?? null;
  }

  if (!adminMembership) {
    return jsonError('Only household admins can invite family members.', 403);
  }

  const adminRoleId = getEffectiveRoleId(adminMembership as unknown as HouseholdMember);
  const { data: adminRole, error: adminRoleError } = await adminClient
    .from('household_roles')
    .select('is_head_parent')
    .eq('id', adminRoleId)
    .maybeSingle();

  const { data: memberPermission, error: permissionError } = await adminClient
    .from('role_permissions')
    .select('level')
    .eq('role_id', adminRoleId)
    .eq('permission_key', 'manage_members')
    .maybeSingle();

  if (adminRoleError && !isMissingCustomRoleSchemaError(adminRoleError)) {
    return jsonError(adminRoleError.message, 500);
  }

  if (permissionError) {
    if (!isMissingCustomRoleSchemaError(permissionError)) {
      return jsonError(permissionError.message, 500);
    }

    if (!hasLegacyInvitePermission(adminMembership as unknown as HouseholdMember)) {
      return jsonError('Your role cannot invite family members.', 403);
    }
  }

  if (!permissionError && !adminRole?.is_head_parent && memberPermission?.level !== 'allowed') {
    return jsonError('Your role cannot invite family members.', 403);
  }

  const requestedRoleId = typeof body.roleId === 'string' ? body.roleId.trim() : '';
  const requestedRoleLookup = requestedRoleId
    ? await adminClient
      .from('household_roles')
      .select('id, base_role')
      .eq('household_id', householdId)
      .eq('id', requestedRoleId)
      .maybeSingle()
    : { data: null, error: null };
  const requestedRole = requestedRoleLookup.data;
  const requestedRoleError = requestedRoleLookup.error;

  if (requestedRoleError && !isMissingCustomRoleSchemaError(requestedRoleError)) {
    return jsonError(requestedRoleError.message, 500);
  }

  if (requestedRoleId && !requestedRole && !isMissingCustomRoleSchemaError(requestedRoleError)) {
    return jsonError('Selected household role was not found.', 400);
  }

  const selectedBaseRole = (requestedRole?.base_role || body.role) as HouseholdRole;
  const selectedRoleId = requestedRole?.id || requestedRoleId || null;
  const validation = validateInvitationRequest({
    displayName: String(body.displayName || ''),
    email: String(body.email || ''),
    role: selectedBaseRole,
  });

  if (!validation.success) {
    return jsonError(validation.error, 400);
  }

  const { data: existingMember, error: existingMemberError } = await adminClient
    .from('household_members')
    .select('id')
    .eq('household_id', householdId)
    .ilike('email', validation.email)
    .maybeSingle();

  if (existingMemberError) {
    return jsonError(existingMemberError.message, 500);
  }

  if (existingMember) {
    return jsonError('A household member already uses that email address.', 409);
  }

  const inviteRedirect = getPasswordResetRedirectUrl(request.nextUrl.origin);
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    validation.email,
    {
      data: {
        display_name: validation.displayName,
        household_id: householdId,
        role: validation.role,
        role_id: selectedRoleId,
      },
      redirectTo: inviteRedirect,
    }
  );

  if (inviteError) {
    return jsonError(inviteError.message, 400);
  }

  const newMember: HouseholdMember = {
    id: `member-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    household_id: householdId,
    user_id: inviteData.user?.id || null,
    role: validation.role,
    role_id: selectedRoleId,
    display_name: validation.displayName,
    email: validation.email,
    created_at: new Date().toISOString(),
  };

  const insertMember = await retryMemberWriteWithoutRoleId(
    () => adminClient
      .from('household_members')
      .insert([newMember])
      .select('*')
      .single(),
    () => adminClient
      .from('household_members')
      .insert([omitMemberRoleId(newMember)])
      .select('*')
      .single()
  );
  const insertedMember = insertMember.data;
  const insertError = insertMember.error;

  if (insertError) {
    return jsonError(insertError.message, 500);
  }

  return NextResponse.json({
    success: true,
    member: {
      ...insertedMember,
      role_id: selectedRoleId,
    },
  });
}
