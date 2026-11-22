import type { Claim, ClaimStatus, Donation } from './types';

export const ACTIVE_CLAIM_STATUSES: readonly ClaimStatus[] = [
  'offered',
  'claimed',
  'pickup_confirmed',
  'collected',
  'distributed',
];

const CLAIMABLE_DONATION_STATUSES: readonly Donation['status'][] = ['posted', 'matched', 'claimed'];

function isActiveClaimFor(claim: Claim, donationId: string): boolean {
  return claim.donationId === donationId && ACTIVE_CLAIM_STATUSES.includes(claim.status);
}

function activeClaimedKg(donationId: string, claims: Claim[]): number {
  return claims
    .filter((claim) => isActiveClaimFor(claim, donationId))
    .reduce((sum, claim) => sum + claim.quantityKg, 0);
}

export function reserveQuantity(
  donation: Donation,
  claims: Claim[],
  receiverId: string,
  quantityKg: number,
): string | null {
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    return 'Quantity must be a positive number of kilograms.';
  }
  if (!CLAIMABLE_DONATION_STATUSES.includes(donation.status)) {
    return 'This donation is not available for claiming.';
  }
  const duplicate = claims.some(
    (claim) => claim.receiverId === receiverId && isActiveClaimFor(claim, donation.id),
  );
  if (duplicate) {
    return 'You already have an active claim on this donation.';
  }
  const bookedKg = activeClaimedKg(donation.id, claims);
  if (bookedKg + quantityKg > donation.quantityKg) {
    return 'Requested quantity exceeds what is still available on this donation.';
  }
  return null;
}

export function availableToClaimKg(donation: Donation, claims: Claim[]): number {
  const remaining = donation.quantityKg - activeClaimedKg(donation.id, claims);
  const floored = Math.max(0, remaining);
  return Math.round(floored * 10) / 10;
}
