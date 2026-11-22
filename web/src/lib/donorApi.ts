import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types (mirror ResQMeal/supabase/migrations/001_schema.sql)
// ---------------------------------------------------------------------------

export type DonationStatus =
  | 'available'
  | 'claimed'
  | 'pickup_scheduled'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'removed';

export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'pickup_scheduled'
  | 'collected'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface DonorDonation {
  id: string;
  donor_id: string;
  title: string;
  category: string;
  description: string;
  quantity: number;
  /** Quantity still claimable (migration 002). Optional so donor-side inserts still type-check. */
  remaining_quantity?: number | null;

  unit: string;
  estimated_people: number;
  prepared_at: string | null;
  expires_at: string;
  pickup_window_start: string;
  pickup_window_end: string;
  image_url: string | null;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pin_code: string;
  latitude: number | null;
  longitude: number | null;
  is_vegetarian: boolean;
  special_instructions: string | null;
  allocation_mode: 'single' | 'multiple';
  status: DonationStatus;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewDonationInput {
  title: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  estimated_people: number;
  prepared_at: string | null;
  expires_at: string;
  pickup_window_start: string;
  pickup_window_end: string;
  image_url: string | null;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_pin_code: string;
  latitude: number | null;
  longitude: number | null;
  is_vegetarian: boolean;
  special_instructions: string | null;
  allocation_mode: 'single' | 'multiple';
}

export type DonationEditPatch = Partial<
  Pick<
    DonorDonation,
    | 'title'
    | 'description'
    | 'category'
    | 'quantity'
    | 'unit'
    | 'estimated_people'
    | 'expires_at'
    | 'pickup_window_start'
    | 'pickup_window_end'
    | 'is_vegetarian'
    | 'special_instructions'
    | 'pickup_address'
    | 'pickup_city'
    | 'pickup_state'
    | 'pickup_pin_code'
    | 'latitude'
    | 'longitude'
    | 'image_url'
  >
>;

export interface DonorRequest {
  id: string;
  donation_id: string;
  receiver_id: string;
  donor_id: string;
  status: RequestStatus;
  message: string | null;
  pickup_scheduled_at: string | null;
  collected_at: string | null;
  completed_at: string | null;
  quantity_collected: number | null;
  created_at: string;
  updated_at: string;
  donation: {
    title: string;
    pickup_address: string;
    pickup_city: string;
    status: DonationStatus;
    quantity: number;
    unit: string;
  } | null;
  receiver: {
    full_name: string | null;
    organization_name: string | null;
    phone: string | null;
    city: string | null;
    state: string | null;
    address_line: string | null;
    pin_code: string | null;
  } | null;
}

export interface DonorNotification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  related_table: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface DonorStats {
  total: number;
  available: number;
  claimed: number;
  completed: number;
  totalQuantity: number;
  estimatedMeals: number;
  monthly: Array<{ month: string; count: number }>;
  completedPickups: number;
}

export interface DonorProfilePatch {
  full_name?: string | null;
  phone?: string | null;
  organization_name?: string | null;
  org_type?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  pin_code?: string | null;
  location_label?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// Raw row shape returned by the embedded select in listIncomingRequests.
type RawDonorRequest = Omit<DonorRequest, 'donation' | 'receiver'> & {
  donation: DonorRequest['donation'] | undefined;
  receiver: DonorRequest['receiver'] | undefined;
};

// One row from the list_donor_requests() RPC (flat, one row per claim).
export interface DonorRequestRow {
  request_id: string;
  donation_id: string;
  donation_title: string;
  donation_unit: string;
  donation_quantity: number;
  donation_remaining: number;
  donation_status: DonationStatus;
  receiver_id: string;
  receiver_name: string | null;
  receiver_organization: string | null;
  receiver_city: string | null;
  receiver_phone: string | null;
  requested_quantity: number;
  request_status: RequestStatus;
  request_message: string | null;
  requested_at: string;
}

const DONATION_IMAGE_BUCKET = 'donation-images';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

export async function uploadDonationImage(userId: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from(DONATION_IMAGE_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(DONATION_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function createDonation(
  userId: string,
  input: NewDonationInput,
): Promise<DonorDonation> {
  const { data, error } = await supabase
    .from('donations')
    .insert({ ...input, donor_id: userId, status: 'available' })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as DonorDonation;
}

export async function listDonations(userId: string): Promise<DonorDonation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('donor_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DonorDonation[];
}

export async function updateDonation(id: string, patch: DonationEditPatch): Promise<void> {
  const { data, error } = await supabase
    .from('donations')
    .update(patch)
    .eq('id', id)
    .eq('status', 'available')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('This donation can no longer be edited.');
  }
}

export async function cancelDonation(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('donations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'available')
    .select('id');
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) {
    throw new Error('Only available donations can be cancelled.');
  }
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getDonorStats(userId: string): Promise<DonorStats> {
  const donations = await listDonations(userId);
  const nowMs = Date.now();

  let available = 0;
  let claimed = 0;
  let completed = 0;
  let totalQuantity = 0;
  let estimatedMeals = 0;

  for (const d of donations) {
    if (d.status === 'available' && new Date(d.expires_at).getTime() > nowMs) {
      available += 1;
    }
    if (d.status === 'claimed') claimed += 1;
    if (d.status === 'completed') {
      completed += 1;
      estimatedMeals += d.estimated_people;
    }
    if (d.status !== 'cancelled') totalQuantity += d.quantity;
  }

  // Last 6 calendar months ending with the current month, zero months included.
  const now = new Date();
  const keys: string[] = [];
  const counts = new Map<string, number>();
  for (let i = 5; i >= 0; i -= 1) {
    const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1));
    keys.push(key);
    counts.set(key, 0);
  }
  for (const d of donations) {
    const key = monthKey(new Date(d.created_at));
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }
  const monthly = keys.map((month) => ({ month, count: counts.get(month) ?? 0 }));

  const { count, error } = await supabase
    .from('food_requests')
    .select('id', { count: 'exact', head: true })
    .eq('donor_id', userId)
    .eq('status', 'completed');
  if (error) throw new Error(error.message);

  return {
    total: donations.length,
    available,
    claimed,
    completed,
    totalQuantity,
    estimatedMeals,
    monthly,
    completedPickups: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Incoming requests
// ---------------------------------------------------------------------------

export async function listIncomingRequests(userId: string): Promise<DonorRequest[]> {
  const { data, error } = await supabase
    .from('food_requests')
    .select(
      '*, donation:donations!donation_id(title, pickup_address, pickup_city, status, quantity, unit), receiver:profiles!receiver_id(full_name, organization_name, phone, city, state, address_line, pin_code)',
    )
    .eq('donor_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawDonorRequest[];
  return rows.map((r) => ({
    ...r,
    donation: r.donation ?? null,
    receiver: r.receiver ?? null,
  }));
}

export async function listDonorRequests(): Promise<DonorRequestRow[]> {
  const { data, error } = await supabase.rpc('list_donor_requests');
  if (error) throw new Error(error.message);
  return (data ?? []) as DonorRequestRow[];
}

export async function decideRequest(
  requestId: string,
  decision: 'accept' | 'reject',
): Promise<void> {
  const { error } = await supabase.rpc('decide_request', {
    p_request_id: requestId,
    p_decision: decision,
  });
  if (error) throw new Error(error.message);
}

export async function schedulePickup(requestId: string, scheduledAtIso: string): Promise<void> {
  const { error } = await supabase.rpc('schedule_pickup', {
    p_request_id: requestId,
    p_scheduled_at: scheduledAtIso,
  });
  if (error) throw new Error(error.message);
}

export async function confirmCompleted(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('confirm_completed', {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

export async function markPickedUp(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_picked_up', {
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
}

export interface CompletedDistribution {
  request_id: string;
  donation_id: string;
  donation_title: string | null;
  donation_category: string | null;
  unit: string | null;
  quantity_distributed: number | null;
  receiver_name: string | null;
  receiver_organization: string | null;
  donor_name: string | null;
  completed_at: string | null;
}

export async function listCompletedDistributions(): Promise<CompletedDistribution[]> {
  const { data, error } = await supabase.rpc('list_completed_distributions');
  if (error) throw new Error(error.message);
  return (data as CompletedDistribution[] | null) ?? [];
}


// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function listNotifications(userId: string): Promise<DonorNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as DonorNotification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false);
  if (error) throw new Error(error.message);
}

export function subscribeToNotifications(
  userId: string,
  onInsert: (n: DonorNotification) => void,
): () => void {
  const channel = supabase
    .channel(`notifications-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new as DonorNotification),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function updateOwnProfile(userId: string, patch: DonorProfilePatch): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
}
