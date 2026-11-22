export type LifecycleStatus =
  | 'posted'
  | 'matched'
  | 'claimed'
  | 'pickup_confirmed'
  | 'collected'
  | 'distribution_recorded'
  | 'completed'
  | 'expired'
  | 'cancelled';

export const LIFECYCLE_ORDER: readonly LifecycleStatus[] = [
  'posted',
  'matched',
  'claimed',
  'pickup_confirmed',
  'collected',
  'distribution_recorded',
  'completed',
  'expired',
  'cancelled',
];

export const LIFECYCLE_LABELS: Record<LifecycleStatus, string> = {
  posted: 'Posted',
  matched: 'Matched',
  claimed: 'Claimed',
  pickup_confirmed: 'Pickup Confirmed',
  collected: 'Collected',
  distribution_recorded: 'Distribution Recorded',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
};


export const CLAIM_HOLD_MINUTES = 30;

const FORWARD_CHAIN: readonly LifecycleStatus[] = [
  'posted',
  'matched',
  'claimed',
  'pickup_confirmed',
  'collected',
  'distribution_recorded',
  'completed',
];

const TERMINAL_STATUSES: readonly LifecycleStatus[] = ['completed', 'expired', 'cancelled'];

export function isTerminal(status: LifecycleStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: LifecycleStatus, to: LifecycleStatus): boolean {
  if (isTerminal(from)) return false;
  if (to === 'expired' || to === 'cancelled') return true;
  const fromIndex = FORWARD_CHAIN.indexOf(from);
  const toIndex = FORWARD_CHAIN.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export function claimExpiresAt(offeredAtIso: string, minutes: number = CLAIM_HOLD_MINUTES): string {
  const offeredAt = new Date(offeredAtIso).getTime();
  return new Date(offeredAt + minutes * 60_000).toISOString();
}

export function isOverdue(pickupDeadlineIso: string, now: Date): boolean {
  return now.getTime() > new Date(pickupDeadlineIso).getTime();
}

