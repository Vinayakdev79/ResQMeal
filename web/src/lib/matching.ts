import { AVERAGE_TRAVEL_KMPH, PICKUP_BUFFER_MINUTES, haversineKm } from './geo';
import type { Donation, User } from './types';

/** Weights for the weighted receiver score. They sum to 1. */
export const MATCHING_WEIGHTS = {
  distance: 0.3,
  pickupTime: 0.3,
  capacity: 0.25,
  foodRequirement: 0.15,
} as const;

/** Planning assumption: kg of food one NGO beneficiary can absorb per day. */
const KG_PER_BENEFICIARY_PER_DAY = 0.25;

/** Slack (minutes) at which the pickup-time score saturates at 1. */
const SLACK_SATURATION_MINUTES = 120;


const MS_PER_MINUTE = 60_000;

export interface RankedReceiver {
  receiverId: string;
  eligible: true;
  distanceKm: number;
  slackMinutes: number;
  scores: {
    distance: number;
    pickupTime: number;
    capacity: number;
    foodRequirement: number;
  };
  total: number;
  reasons: string[];
}

type Assessment =
  | { ok: true; distanceKm: number; slackMinutes: number; capacityKg: number }
  | { ok: false; reason: string };

const fail = (reason: string): Assessment => ({ ok: false, reason });

const clamp01 = (x: number): number => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/**
 * Step A: eligibility (exclusion). Shared by rankReceivers and explainExclusion so the
 * UI explanation always matches the engine's decision.
 */
function assess(donation: Donation, user: User, now: Date): Assessment {
  if (user.role !== 'receiver') {
    return fail('Only receivers can receive food');
  }
  if (!user.verified) {
    return fail('Receiver is not verified');
  }
  if (user.lat === undefined || user.lng === undefined) {
    return fail('No service location on record');
  }
  if (user.serviceRadiusKm === undefined) {
    return fail('No service radius on record');
  }

  const deadlineMs = new Date(donation.pickupDeadline).getTime();
  if (Number.isNaN(deadlineMs)) {
    return fail('Donation has an invalid pickup deadline');
  }


  const distanceKm = haversineKm(user.lat, user.lng, donation.pickupLat, donation.pickupLng);
  if (distanceKm > user.serviceRadiusKm) {
    return fail(
      `Pickup is ${distanceKm.toFixed(1)} km away, beyond the ${user.serviceRadiusKm} km service radius`,
    );
  }

  const travelMinutes = (distanceKm / AVERAGE_TRAVEL_KMPH) * 60;
  const arrivalMs = now.getTime() + (travelMinutes + PICKUP_BUFFER_MINUTES) * MS_PER_MINUTE;
  if (arrivalMs > deadlineMs) {
    return fail(
      `Estimated arrival (${Math.round(travelMinutes + PICKUP_BUFFER_MINUTES)} min incl. buffer) is after the pickup deadline`,
    );
  }

  const slackMinutes = (deadlineMs - arrivalMs) / MS_PER_MINUTE;

  // Receiver capacity: beneficiaries × planning assumption.
  const capacityKg = (user.beneficiaryCapacity ?? 0) * KG_PER_BENEFICIARY_PER_DAY;

  return { ok: true, distanceKm, slackMinutes, capacityKg };
}

/**
 * Returns why a receiver is excluded from a donation, or null if they are eligible.
 * Intended for UI explanations.
 */
export function explainExclusion(donation: Donation, user: User, now: Date): string | null {
  const result = assess(donation, user, now);
  return result.ok ? null : result.reason;
}

/**
 * Deterministic ranking of eligible receivers for a donation.
 * Excluded receivers are omitted. Sorted by total score (desc), then receiverId (asc).
 */
export function rankReceivers(donation: Donation, candidates: User[], now: Date): RankedReceiver[] {
  const ranked: RankedReceiver[] = [];

  for (const user of candidates) {
    const result = assess(donation, user, now);
    if (!result.ok) continue;

    const distanceScore = clamp01(1 - result.distanceKm / (user.serviceRadiusKm ?? 1));
    const pickupTimeScore = clamp01(result.slackMinutes / SLACK_SATURATION_MINUTES);
    const capacityScore =
      donation.quantityAvailableKg > 0
        ? clamp01(result.capacityKg / donation.quantityAvailableKg)
        : 0;
    // Placeholder: receivers are assumed to accept veg, mixed and non-veg food alike.
    // Change this function when real dietary acceptance rules exist.
    const foodRequirementScore = 1;

    const total =
      MATCHING_WEIGHTS.distance * distanceScore +
      MATCHING_WEIGHTS.pickupTime * pickupTimeScore +
      MATCHING_WEIGHTS.capacity * capacityScore +
      MATCHING_WEIGHTS.foodRequirement * foodRequirementScore;

    ranked.push({
      receiverId: user.id,
      eligible: true,
      distanceKm: result.distanceKm,
      slackMinutes: result.slackMinutes,
      scores: {
        distance: distanceScore,
        pickupTime: pickupTimeScore,
        capacity: capacityScore,
        foodRequirement: foodRequirementScore,
      },
      total,
      reasons: [
        `${result.distanceKm.toFixed(1)} km from pickup`,
        `${Math.round(result.slackMinutes)} min slack before pickup deadline`,
        `Capacity ${result.capacityKg.toFixed(1)} kg for ${donation.quantityAvailableKg} kg available`,
        `${donation.vegType} food accepted (placeholder rule)`,
      ],
    });
  }

  return ranked.sort((a, b) => b.total - a.total || a.receiverId.localeCompare(b.receiverId));
}

/**
 * Greedy allocation in rank order. Each receiver gets min(their remaining capacity, remaining food),
 * rounded down to 0.1 kg. Total never exceeds donation.quantityAvailableKg.
 */
export function allocate(
  donation: Donation,
  ranked: RankedReceiver[],
  capacityKgByReceiver: Record<string, number>,
): { receiverId: string; quantityKg: number }[] {
  let remaining = donation.quantityAvailableKg;
  const allocations: { receiverId: string; quantityKg: number }[] = [];

  for (const receiver of ranked) {
    if (remaining <= 0) break;
    const capacity = capacityKgByReceiver[receiver.receiverId] ?? 0;
    const give = Math.floor(Math.min(capacity, remaining) * 10) / 10;
    if (give <= 0) continue;

    allocations.push({ receiverId: receiver.receiverId, quantityKg: give });
    remaining = Math.round((remaining - give) * 10) / 10;
  }

  return allocations;
}
