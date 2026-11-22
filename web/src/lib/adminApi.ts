import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types (mirror ResQMeal/supabase/migrations/001_schema.sql)
// ---------------------------------------------------------------------------

export interface AdminProfile {
  id: string;
  role: 'donor' | 'receiver' | 'admin';
  full_name: string | null;
  organization_name: string | null;
  city: string | null;
  is_verified: boolean;
  is_suspended: boolean;
  created_at: string;
}

export interface AdminDonation {
  id: string;
  donor_id: string;
  title: string;
  category: string;
  quantity: number;
  unit: string;
  status:
    | 'available'
    | 'claimed'
    | 'pickup_scheduled'
    | 'completed'
    | 'expired'
    | 'cancelled'
    | 'removed';
  expires_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Admin reads and writes (RLS: public.is_admin())
// ---------------------------------------------------------------------------

export async function listAllProfiles(): Promise<AdminProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name, organization_name, city, is_verified, is_suspended, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminProfile[];
}

export async function listAllDonations(): Promise<AdminDonation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('id, donor_id, title, category, quantity, unit, status, expires_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AdminDonation[];
}

export async function setUserVerified(id: string, verified: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: verified })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
