import { supabase } from './supabase';
import type { DonationStatus, DonorDonation, RequestStatus } from './donorApi';

// ---------------------------------------------------------------------------
// Types (mirror ResQMeal/supabase/migrations/001_schema.sql and 002_multi_claim_quantities.sql)
// ---------------------------------------------------------------------------

/** Request statuses that no longer block a new claim on the same donation. */
export const INACTIVE_REQUEST_STATUSES: readonly RequestStatus[] = ['rejected', 'cancelled', 'failed'];

export interface ReceiverRequest {
  id: string;
  donation_id: string;
  receiver_id: string;
  donor_id: string;
  status: RequestStatus;
  message: string | null;
  requested_quantity: number | null;
  pickup_scheduled_at: string | null;
  collected_at: string | null;
  completed_at: string | null;
  quantity_collected: number | null;
  created_at: string;
  updated_at: string;
  donation: {
    title: string | null;
    pickup_address: string | null;
    pickup_city: string | null;
    status: DonationStatus;
    quantity: number | null;
    unit: string | null;
    expires_at: string | null;
  } | null;
}

// Raw row shape returned by the embedded select in listMyFoodRequests.
type RawReceiverRequest = Omit<ReceiverRequest, 'donation'> & {
  donation: ReceiverRequest['donation'] | undefined;
};

// ---------------------------------------------------------------------------
// Donations
// ---------------------------------------------------------------------------

/**
 * Donations a receiver can claim: status 'available', quantity still remaining,
 * and not yet expired. Read through the donations_select RLS policy (authenticated receivers).
 * '*' already includes remaining_quantity.
 */
export async function listAvailableDonations(): Promise<DonorDonation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('status', 'available')
    .gt('remaining_quantity', 0)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as DonorDonation[];
}

/**
 * Claim a quantity of a donation through the claim_donation_quantity RPC. The RPC locks the
 * row and enforces the remaining quantity atomically. Its error text is rethrown as-is.
 */
export async function claimDonation(donationId: string, quantity: number, message?: string): Promise<void> {
  const trimmed = message?.trim() ?? '';
  const { error } = await supabase.rpc('claim_donation_quantity', {
    p_donation_id: donationId,
    p_quantity: quantity,
    p_message: trimmed === '' ? null : trimmed,
  });
  if (error) throw new Error(error.message);
}

/**
 * Subscribe to changes on donations and food_requests. Calls onChange on every change.
 * Returns an unsubscribe function that removes the channel.
 */
export function subscribeToClaimUpdates(onChange: () => void): () => void {
  const channel = supabase
    .channel(`receiver-claim-updates-${Math.random().toString(36).slice(2)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'food_requests' }, onChange)
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// Receiver's own requests
// ---------------------------------------------------------------------------

/** The receiver's food_requests with a small donation summary (food_requests_select RLS). */
export async function listMyFoodRequests(receiverId: string): Promise<ReceiverRequest[]> {
  const { data, error } = await supabase
    .from('food_requests')
    .select(
      '*, requested_quantity, donation:donations!donation_id(title, pickup_address, pickup_city, status, quantity, unit, expires_at)',
    )
    .eq('receiver_id', receiverId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as RawReceiverRequest[];
  return rows.map((r) => ({ ...r, donation: r.donation ?? null }));
}
