import { LIFECYCLE_ORDER, claimExpiresAt, isOverdue } from './lifecycle';
import type { LifecycleStatus } from './lifecycle';
import { allocate, rankReceivers } from './matching';
import { ACTIVE_CLAIM_STATUSES, availableToClaimKg, reserveQuantity } from './reservation';
import type {
  AppState,
  Claim,
  ClaimStatus,
  Dispute,
  Donation,
  FundingEntry,
  TimelineEntry,
  User,
  VegType,
} from './types';

/** Mirrors the NGO planning assumption in matching.ts (that constant is not exported there). */
const KG_PER_BENEFICIARY_PER_DAY = 0.25;

/** Donation statuses that a pickup deadline does not expire. */
const DEADLINE_EXEMPT_STATUSES: readonly LifecycleStatus[] = [
  'completed',
  'collected',
  'distribution_recorded',
  'cancelled',
  'expired',
];

/** Claim statuses that are still open when a pickup deadline passes. */
const DEADLINE_EXPIRABLE_CLAIM_STATUSES: readonly ClaimStatus[] = ['offered', 'claimed', 'pickup_confirmed'];

/** Claim statuses that count as food actually committed to a receiver. */
const COMMITTED_CLAIM_STATUSES: readonly ClaimStatus[] = [
  'claimed',
  'pickup_confirmed',
  'collected',
  'distributed',
];

/** Claim statuses cancelled when the donor cancels the donation. */
const CANCELLABLE_CLAIM_STATUSES: readonly ClaimStatus[] = ['offered', 'claimed', 'pickup_confirmed'];

/** Donation statuses in which a donor may not cancel. */
const CANCEL_BLOCKED_STATUSES: readonly LifecycleStatus[] = [
  'collected',
  'distribution_recorded',
  'completed',
  'expired',
  'cancelled',
];

export interface NewDonationInput {
  donorId: string;
  eventId?: string;
  foodName: string;
  category: string;
  vegType: VegType;
  quantityKg: number;
  estimatedPortions: number;
  prepTimeAt: string;
  storageCondition: string;
  allergens: string;
  pickupDeadline: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  anonymousDonor: boolean;
}

export type DonationEditPatch = Partial<
  Pick<
    Donation,
    'foodName' | 'category' | 'storageCondition' | 'allergens' | 'pickupDeadline' | 'estimatedPortions' | 'pickupAddress'
  >
>;

interface TimelineInput {
  donationId: string;
  claimId?: string;
  actorId?: string;
  fromStatus?: string;
  toStatus: string;
  note: string;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function replaceById<T extends { id: string }>(items: T[], item: T): T[] {
  return items.map((x) => (x.id === item.id ? item : x));
}

function findDonation(state: AppState, donationId: string): Donation | undefined {
  return state.donations.find((d) => d.id === donationId);
}

function requireDonation(state: AppState, donationId: string): Donation {
  const donation = findDonation(state, donationId);
  if (!donation) throw new Error('Donation not found.');
  return donation;
}

function requireClaim(state: AppState, claimId: string): Claim {
  const claim = state.claims.find((c) => c.id === claimId);
  if (!claim) throw new Error('Claim not found.');
  return claim;
}

function userName(state: AppState, userId: string): string {
  return state.users.find((u) => u.id === userId)?.name ?? 'a receiver';
}

function appendTimeline(state: AppState, input: TimelineInput, now: Date): AppState {
  const entry: TimelineEntry = { id: newId('tl'), at: now.toISOString(), ...input };
  return { ...state, timeline: [...state.timeline, entry] };
}

/** Sets a donation status unconditionally and records it in the timeline. */
function setDonationStatus(
  state: AppState,
  donationId: string,
  to: LifecycleStatus,
  note: string,
  now: Date,
  actorId?: string,
  claimId?: string,
): AppState {
  const donation = requireDonation(state, donationId);
  const updated: Donation = { ...donation, status: to, updatedAt: now.toISOString() };
  const next: AppState = { ...state, donations: replaceById(state.donations, updated) };
  return appendTimeline(
    next,
    { donationId, claimId, actorId, fromStatus: donation.status, toStatus: to, note },
    now,
  );
}

/** Moves a donation forward along LIFECYCLE_ORDER only. Never moves it backwards. */
function advanceDonation(
  state: AppState,
  donationId: string,
  to: LifecycleStatus,
  note: string,
  now: Date,
  actorId?: string,
  claimId?: string,
): AppState {
  const donation = requireDonation(state, donationId);
  if (LIFECYCLE_ORDER.indexOf(to) <= LIFECYCLE_ORDER.indexOf(donation.status)) return state;
  return setDonationStatus(state, donationId, to, note, now, actorId, claimId);
}

/** Keeps donation.quantityAvailableKg equal to the kg not yet held by active claims. */
function syncAvailability(state: AppState, donationId: string): AppState {
  const donation = findDonation(state, donationId);
  if (!donation) return state;
  const updated: Donation = {
    ...donation,
    quantityAvailableKg: availableToClaimKg(donation, state.claims),
  };
  return { ...state, donations: replaceById(state.donations, updated) };
}

/** Changes a claim's status (plus any extra fields) and records it in the timeline. */
function transitionClaim(
  state: AppState,
  claimId: string,
  to: ClaimStatus,
  changes: Partial<Claim>,
  note: string,
  now: Date,
  actorId?: string,
): AppState {
  const claim = requireClaim(state, claimId);
  const updated: Claim = { ...claim, ...changes, status: to, updatedAt: now.toISOString() };
  const next: AppState = { ...state, claims: replaceById(state.claims, updated) };
  return appendTimeline(
    next,
    { donationId: claim.donationId, claimId, actorId, fromStatus: claim.status, toStatus: to, note },
    now,
  );
}

function assertClaimOwnership(claim: Claim, receiverId: string, expected: ClaimStatus): void {
  if (claim.receiverId !== receiverId) {
    throw new Error('This claim belongs to a different receiver.');
  }
  if (claim.status !== expected) {
    throw new Error(`This action needs a claim that is ${expected} (it is currently ${claim.status}).`);
  }
}

function collectedTotalKg(state: AppState, donationId: string): number {
  const total = state.claims
    .filter((c) => c.donationId === donationId)
    .reduce((sum, c) => sum + c.collectedKg, 0);
  return Math.round(total * 10) / 10;
}

function capacityKgFor(user: User): number {
  return user.role === 'receiver'
    ? (user.beneficiaryCapacity ?? 0) * KG_PER_BENEFICIARY_PER_DAY
    : (user.maxClaimKg ?? 0);
}

/** Claims that are still open (offered or later, not yet terminal) for a donation. */
export function activeClaimsFor(state: AppState, donationId: string): Claim[] {
  return state.claims.filter(
    (c) => c.donationId === donationId && ACTIVE_CLAIM_STATUSES.includes(c.status),
  );
}

/** Minutes left until a claim's hold expires, and whether the hold has already lapsed. */
export function claimDeadlineInfo(
  claim: Claim,
  now: Date,
): { minutesLeft: number; overdueDeadline: boolean } {
  const diffMs = Date.parse(claim.claimExpiresAt) - now.getTime();
  return {
    minutesLeft: Math.max(0, Math.floor(diffMs / 60_000)),
    overdueDeadline: diffMs < 0,
  };
}

/**
 * Ranks eligible receivers who have no claim on this donation yet, then offers the
 * remaining unallocated quantity to them in rank order. Never overbooks.
 */
function offerRemaining(state: AppState, donationId: string, now: Date): AppState {
  const donation = findDonation(state, donationId);
  if (!donation) return state;
  if (donation.status !== 'posted' && donation.status !== 'matched' && donation.status !== 'claimed') {
    return state;
  }

  const remainingKg = availableToClaimKg(donation, state.claims);
  if (remainingKg <= 0) return state;

  const alreadyInvolved = new Set(
    state.claims.filter((c) => c.donationId === donationId).map((c) => c.receiverId),
  );
  const candidates = state.users.filter(
    (u) => u.role === 'receiver' && !alreadyInvolved.has(u.id),
  );

  const view: Donation = { ...donation, quantityAvailableKg: remainingKg };
  const ranked = rankReceivers(view, candidates, now);
  const capacityKgByReceiver: Record<string, number> = {};
  for (const user of candidates) {
    capacityKgByReceiver[user.id] = capacityKgFor(user);
  }
  const allocations = allocate(view, ranked, capacityKgByReceiver);

  let next = state;
  let offeredCount = 0;
  for (const allocation of allocations) {
    const current = findDonation(next, donationId);
    if (!current) break;
    const error = reserveQuantity(current, next.claims, allocation.receiverId, allocation.quantityKg);
    if (error !== null) continue;

    const iso = now.toISOString();
    const claim: Claim = {
      id: newId('cl'),
      donationId,
      receiverId: allocation.receiverId,
      quantityKg: allocation.quantityKg,
      status: 'offered',
      claimExpiresAt: claimExpiresAt(iso),
      collectedKg: 0,
      distributedKg: 0,
      beneficiariesReached: 0,
      createdAt: iso,
      updatedAt: iso,
    };
    next = { ...next, claims: [...next.claims, claim] };
    next = appendTimeline(
      next,
      {
        donationId,
        claimId: claim.id,
        toStatus: 'offered',
        note: `Offered ${claim.quantityKg} kg to ${userName(next, claim.receiverId)}`,
      },
      now,
    );
    offeredCount += 1;
  }

  if (offeredCount === 0) return state;
  next = advanceDonation(next, donationId, 'matched', `Matched to ${offeredCount} receiver(s)`, now);
  return syncAvailability(next, donationId);
}

/** Validates and creates a posted donation. Throws an Error with a user-facing message on bad input. */
export function createDonation(state: AppState, input: NewDonationInput, now: Date): AppState {
  const foodName = input.foodName.trim();
  if (foodName === '') throw new Error('Food name is required.');
  if (!Number.isFinite(input.quantityKg) || input.quantityKg <= 0) {
    throw new Error('Quantity must be greater than 0 kg.');
  }
  if (!Number.isInteger(input.estimatedPortions) || input.estimatedPortions < 0) {
    throw new Error('Estimated portions must be a whole number of 0 or more.');
  }
  const deadlineMs = Date.parse(input.pickupDeadline);
  if (Number.isNaN(deadlineMs) || deadlineMs <= now.getTime()) {
    throw new Error('Pickup deadline must be in the future.');
  }
  if (!Number.isFinite(input.pickupLat) || !Number.isFinite(input.pickupLng)) {
    throw new Error('Pickup location needs valid coordinates.');
  }

  const iso = now.toISOString();
  const donation: Donation = {
    id: newId('dn'),
    donorId: input.donorId,
    eventId: input.eventId,
    foodName,
    category: input.category,
    vegType: input.vegType,
    quantityKg: input.quantityKg,
    estimatedPortions: input.estimatedPortions,
    prepTimeAt: input.prepTimeAt,
    storageCondition: input.storageCondition,
    allergens: input.allergens,
    pickupDeadline: input.pickupDeadline,
    pickupAddress: input.pickupAddress,
    pickupLat: input.pickupLat,
    pickupLng: input.pickupLng,
    status: 'posted',
    quantityAvailableKg: input.quantityKg,
    anonymousDonor: input.anonymousDonor,
    createdAt: iso,
    updatedAt: iso,
  };

  const next: AppState = { ...state, donations: [...state.donations, donation] };
  return appendTimeline(
    next,
    {
      donationId: donation.id,
      actorId: input.donorId,
      toStatus: 'posted',
      note: `Donation posted: ${foodName}, ${input.quantityKg} kg`,
    },
    now,
  );
}

/** Edits a donation's details. Allowed only while posted or matched, with no active claims. */
export function editDonation(
  state: AppState,
  donationId: string,
  patch: DonationEditPatch,
  actorId: string,
  now: Date,
): AppState {
  const donation = requireDonation(state, donationId);
  if (donation.status !== 'posted' && donation.status !== 'matched') {
    throw new Error(`A donation with status "${donation.status}" can no longer be edited.`);
  }
  if (activeClaimsFor(state, donationId).length > 0) {
    throw new Error('This donation has active claims and cannot be edited right now.');
  }
  if (patch.foodName !== undefined && patch.foodName.trim() === '') {
    throw new Error('Food name is required.');
  }
  if (
    patch.estimatedPortions !== undefined &&
    (!Number.isInteger(patch.estimatedPortions) || patch.estimatedPortions < 0)
  ) {
    throw new Error('Estimated portions must be a whole number of 0 or more.');
  }
  if (patch.pickupDeadline !== undefined) {
    const deadlineMs = Date.parse(patch.pickupDeadline);
    if (Number.isNaN(deadlineMs) || deadlineMs <= now.getTime()) {
      throw new Error('Pickup deadline must be in the future.');
    }
  }

  const updated: Donation = {
    ...donation,
    ...patch,
    foodName: patch.foodName !== undefined ? patch.foodName.trim() : donation.foodName,
    updatedAt: now.toISOString(),
  };
  const next: AppState = { ...state, donations: replaceById(state.donations, updated) };
  return appendTimeline(
    next,
    {
      donationId,
      actorId,
      fromStatus: donation.status,
      toStatus: donation.status,
      note: `Donation edited: ${Object.keys(patch).join(', ')}`,
    },
    now,
  );
}

/**
 * Cancels a donation. Offered, claimed and pickup-confirmed claims become cancelled.
 * Refused once food has been collected or the donation is already terminal.
 */
export function cancelDonation(state: AppState, donationId: string, actorId: string, now: Date): AppState {
  const donation = requireDonation(state, donationId);
  if (CANCEL_BLOCKED_STATUSES.includes(donation.status)) {
    throw new Error(`A donation with status "${donation.status}" cannot be cancelled.`);
  }

  let next = state;
  for (const claim of state.claims) {
    if (claim.donationId !== donationId) continue;
    if (!CANCELLABLE_CLAIM_STATUSES.includes(claim.status)) continue;
    next = transitionClaim(next, claim.id, 'cancelled', {}, 'Cancelled with the donation', now, actorId);
  }

  next = setDonationStatus(next, donationId, 'cancelled', 'Donation cancelled by donor', now, actorId);
  return syncAvailability(next, donationId);
}

/** Creates offered claims for the top-ranked eligible receivers. Donation must be posted or matched. */
export function computeOffers(state: AppState, donationId: string, now: Date): AppState {
  const donation = requireDonation(state, donationId);
  if (donation.status !== 'posted' && donation.status !== 'matched') {
    throw new Error(`Offers cannot be made for a donation with status "${donation.status}".`);
  }
  return offerRemaining(state, donationId, now);
}

/**
 * Offers the remaining unallocated quantity to eligible receivers who have no claim on
 * this donation yet. If nothing is offered and no active claims remain, a matched donation
 * goes back to posted.
 */
export function offerNext(state: AppState, donationId: string, now: Date): AppState {
  const offered = offerRemaining(state, donationId, now);
  const donation = findDonation(offered, donationId);
  if (!donation) return offered;
  if (donation.status === 'matched' && activeClaimsFor(offered, donationId).length === 0) {
    return setDonationStatus(
      offered,
      donationId,
      'posted',
      'No eligible receivers remain; donation is open again',
      now,
    );
  }
  return offered;
}

/** Receiver accepts an offer. If the offer's hold has already lapsed, it is expired and passed on instead. */
export function claimOffer(state: AppState, claimId: string, receiverId: string, now: Date): AppState {
  const claim = requireClaim(state, claimId);
  assertClaimOwnership(claim, receiverId, 'offered');

  if (Date.parse(claim.claimExpiresAt) <= now.getTime()) {
    const expired = transitionClaim(
      state,
      claimId,
      'expired',
      {},
      'Offer expired before it was claimed; passed to the next receiver',
      now,
      receiverId,
    );
    return offerNext(expired, claim.donationId, now);
  }

  const claimed = transitionClaim(state, claimId, 'claimed', {}, `Claimed ${claim.quantityKg} kg`, now, receiverId);
  return advanceDonation(claimed, claim.donationId, 'claimed', 'Offer claimed', now, receiverId, claimId);
}

/** Receiver declines an offer. The remaining quantity is offered to the next eligible receiver. */
export function rejectOffer(
  state: AppState,
  claimId: string,
  receiverId: string,
  reason: string,
  now: Date,
): AppState {
  const claim = requireClaim(state, claimId);
  assertClaimOwnership(claim, receiverId, 'offered');

  const trimmed = reason.trim();
  const rejected = transitionClaim(
    state,
    claimId,
    'rejected',
    {},
    trimmed === '' ? 'Offer declined' : `Offer declined: ${trimmed}`,
    now,
    receiverId,
  );
  const synced = syncAvailability(rejected, claim.donationId);
  return offerNext(synced, claim.donationId, now);
}

/** Expires overdue offers and passes their quantity on, and expires open claims past their donation's pickup deadline. */
export function expireOverdueClaims(state: AppState, now: Date): AppState {
  let next = state;

  // 1. Donations past their pickup deadline: expire the donation and its open claims.
  const overdueDonations = state.donations.filter(
    (d) => isOverdue(d.pickupDeadline, now) && !DEADLINE_EXEMPT_STATUSES.includes(d.status),
  );
  for (const donation of overdueDonations) {
    for (const claim of next.claims) {
      if (claim.donationId !== donation.id) continue;
      if (!DEADLINE_EXPIRABLE_CLAIM_STATUSES.includes(claim.status)) continue;
      next = transitionClaim(next, claim.id, 'expired', {}, 'Pickup deadline passed', now);
    }
    next = setDonationStatus(next, donation.id, 'expired', 'Pickup deadline passed', now);
    next = syncAvailability(next, donation.id);
  }

  // 2. Offers whose hold has lapsed: expire them and pass the quantity on.
  const lapsed = next.claims.filter(
    (c) => c.status === 'offered' && Date.parse(c.claimExpiresAt) < now.getTime(),
  );
  const affectedDonationIds: string[] = [];
  for (const claim of lapsed) {
    next = transitionClaim(
      next,
      claim.id,
      'expired',
      {},
      'Offer hold lapsed; passed to the next receiver',
      now,
    );
    if (!affectedDonationIds.includes(claim.donationId)) {
      affectedDonationIds.push(claim.donationId);
    }
  }
  for (const donationId of affectedDonationIds) {
    next = syncAvailability(next, donationId);
    next = offerNext(next, donationId, now);
  }

  return next;
}

/** Receiver confirms they will pick up a claimed offer. */
export function confirmPickup(state: AppState, claimId: string, receiverId: string, now: Date): AppState {
  const claim = requireClaim(state, claimId);
  assertClaimOwnership(claim, receiverId, 'claimed');

  const confirmed = transitionClaim(state, claimId, 'pickup_confirmed', {}, 'Pickup confirmed', now, receiverId);
  return advanceDonation(
    confirmed,
    claim.donationId,
    'pickup_confirmed',
    'Pickup confirmed',
    now,
    receiverId,
    claimId,
  );
}

/** Records the kg actually collected for a pickup-confirmed claim. */
export function recordCollection(
  state: AppState,
  claimId: string,
  receiverId: string,
  collectedKg: number,
  now: Date,
): AppState {
  const claim = requireClaim(state, claimId);
  assertClaimOwnership(claim, receiverId, 'pickup_confirmed');
  if (!Number.isFinite(collectedKg) || collectedKg <= 0 || collectedKg > claim.quantityKg) {
    throw new Error(`Collected quantity must be above 0 kg and at most ${claim.quantityKg} kg.`);
  }

  let next = transitionClaim(
    state,
    claimId,
    'collected',
    { collectedKg },
    `Collected ${collectedKg} kg`,
    now,
    receiverId,
  );
  next = advanceDonation(next, claim.donationId, 'collected', 'Food collected', now, receiverId, claimId);
  const total = collectedTotalKg(next, claim.donationId);
  const donationNow = requireDonation(next, claim.donationId);
  return appendTimeline(
    next,
    {
      donationId: claim.donationId,
      claimId,
      actorId: receiverId,
      fromStatus: donationNow.status,
      toStatus: donationNow.status,
      note: `Donation collected total: ${total} kg`,
    },
    now,
  );
}

/**
 * Records distribution for a collected claim. The donation becomes distribution_recorded
 * while some committed claims remain, and completed once every committed claim is distributed.
 */
export function recordDistribution(
  state: AppState,
  claimId: string,
  receiverId: string,
  distributedKg: number,
  beneficiariesReached: number,
  now: Date,
): AppState {
  const claim = requireClaim(state, claimId);
  assertClaimOwnership(claim, receiverId, 'collected');
  if (!Number.isFinite(distributedKg) || distributedKg <= 0 || distributedKg > claim.collectedKg) {
    throw new Error(`Distributed quantity must be above 0 kg and at most ${claim.collectedKg} kg.`);
  }
  if (!Number.isInteger(beneficiariesReached) || beneficiariesReached < 0) {
    throw new Error('Beneficiaries reached must be a whole number of 0 or more.');
  }

  const distributed = transitionClaim(
    state,
    claimId,
    'distributed',
    { distributedKg, beneficiariesReached },
    `Distributed ${distributedKg} kg to ${beneficiariesReached} beneficiaries`,
    now,
    receiverId,
  );
  const committed = distributed.claims.filter(
    (c) => c.donationId === claim.donationId && COMMITTED_CLAIM_STATUSES.includes(c.status),
  );
  const allDistributed = committed.every((c) => c.status === 'distributed');
  return advanceDonation(
    distributed,
    claim.donationId,
    allDistributed ? 'completed' : 'distribution_recorded',
    allDistributed ? 'All claims distributed; donation completed' : 'Distribution recorded',
    now,
    receiverId,
    claimId,
  );
}

/** Opens a dispute on a donation, optionally tied to one claim. */
export function reportIssue(
  state: AppState,
  donationId: string,
  claimId: string | undefined,
  reporterId: string,
  reason: string,
  now: Date,
): AppState {
  const donation = requireDonation(state, donationId);
  const trimmed = reason.trim();
  if (trimmed === '') throw new Error('Please describe the issue.');

  const dispute: Dispute = {
    id: newId('dp'),
    donationId,
    claimId,
    reporterId,
    reason: trimmed,
    status: 'open',
    createdAt: now.toISOString(),
  };
  const next: AppState = { ...state, disputes: [...state.disputes, dispute] };
  return appendTimeline(
    next,
    {
      donationId,
      claimId,
      actorId: reporterId,
      fromStatus: donation.status,
      toStatus: donation.status,
      note: `Issue reported: ${trimmed}`,
    },
    now,
  );
}

/** Adds a sponsor funding entry. Funding is not tied to a donation, so it adds no timeline entry. */
export function addFunding(
  state: AppState,
  sponsorId: string,
  amountInr: number,
  note: string,
  now: Date,
): AppState {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    throw new Error('Funding amount must be greater than 0.');
  }
  const entry: FundingEntry = {
    id: newId('fd'),
    sponsorId,
    amountInr,
    date: now.toISOString().slice(0, 10),
    note: note.trim(),
  };
  return { ...state, funding: [...state.funding, entry] };
}
