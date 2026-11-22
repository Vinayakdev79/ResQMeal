import { supabase } from '../lib/supabase';
import type { Role, User } from '../lib/types';

/** Roles stored in public.profiles.role (see 001_schema.sql). */
export type AuthRole = 'donor' | 'receiver' | 'admin';

/** Row shape of public.profiles. Column names match the database exactly. */
export interface Profile {
  id: string;
  role: AuthRole;
  full_name: string | null;
  phone: string | null;
  organization_name: string | null;
  org_type: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  pin_code: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  people_served: number | null;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
  updated_at: string;
}

export const PROFILE_COLUMNS =
  'id, role, full_name, phone, organization_name, org_type, address_line, city, state, pin_code, location_label, latitude, longitude, people_served, is_verified, is_suspended, created_at, updated_at';

/** Values of org_type that map onto the dashboard DonorType union. */
const DASHBOARD_DONOR_TYPES: readonly string[] = ['restaurant', 'caterer', 'hotel', 'event_organiser', 'wedding_host'];

export interface ProfileLoadResult {
  profile: Profile | null;
  error: string | null;
}

/** Load the profile row for an auth user id. Returns null (no error) when no row exists. */
export async function fetchProfile(userId: string): Promise<ProfileLoadResult> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    return { profile: null, error: error.message };
  }
  return { profile: (data as Profile | null) ?? null, error: null };
}

/** Map a profile row onto the User shape the existing dashboards consume. */
export function profileToUser(profile: Profile, email: string): User {
  const donorType = DASHBOARD_DONOR_TYPES.includes(profile.org_type ?? '')
    ? (profile.org_type as User['donorType'])
    : undefined;
  return {
    id: profile.id,
    role: profile.role as Role,
    name: profile.full_name || profile.organization_name || email,
    email,
    verified: profile.is_verified,
    anonymousPublic: false,
    donorType,
    lat: profile.latitude ?? undefined,
    lng: profile.longitude ?? undefined,
    address: profile.address_line ?? undefined,
    beneficiaryCapacity: profile.role === 'receiver' ? (profile.people_served ?? undefined) : undefined,
  };
}
