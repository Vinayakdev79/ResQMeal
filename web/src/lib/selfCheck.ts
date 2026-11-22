import { haversineKm } from './geo';
import { estimatedEmissionsAvoidedKg, mealsSaved } from './impact';
import { allocate, rankReceivers } from './matching';
import type { Donation, User } from './types';

/**
 * Pure self-checks for the matching, allocation and impact logic.
 * Returns failure messages. An empty array means every check passed. Not run automatically.
 */
export function selfCheck(): string[] {
  const failures: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) failures.push(message);
  };

  const now = new Date('2025-01-06T10:00:00+05:30');
  const PICKUP_LAT = 27.4924;
  const PICKUP_LNG = 77.6737;

  // 1. Haversine of identical points is 0.
  check(haversineKm(PICKUP_LAT, PICKUP_LNG, PICKUP_LAT, PICKUP_LNG) === 0, 'haversineKm(same point) should be 0');

  const donationFor = (pickupDeadline: string, quantityAvailableKg: number): Donation => ({
    id: 'd-selfcheck',
    donorId: 'donor-selfcheck',
    foodName: 'Dal and rice',
    category: 'cooked',
    vegType: 'veg',
    quantityKg: quantityAvailableKg,
    estimatedPortions: Math.round(quantityAvailableKg * 2.5),
    prepTimeAt: now.toISOString(),
    storageCondition: 'hot holding',
    allergens: 'none',
    pickupDeadline,
    pickupAddress: 'Selfcheck pickup point, Mathura',
    pickupLat: PICKUP_LAT,
    pickupLng: PICKUP_LNG,
    status: 'posted',
    quantityAvailableKg,
    anonymousDonor: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const makeNgo = (id: string, lat: number, lng: number): User => ({
    id,
    role: 'receiver',
    name: id,
    email: `${id}@selfcheck.local`,
    verified: true,
    anonymousPublic: false,
    lat,
    lng,
    serviceRadiusKm: 50,
    beneficiaryCapacity: 200,
  });

  // 2. Deadline exclusion. A receiver about 25 km away needs ~75 min (travel + buffer).
  const farReceiver = makeNgo('ngo-far', PICKUP_LAT + 0.2255, PICKUP_LNG);
  const tightDeadline = donationFor(new Date(now.getTime() + 10 * 60_000).toISOString(), 10);
  const looseDeadline = donationFor(new Date(now.getTime() + 180 * 60_000).toISOString(), 10);
  check(
    rankReceivers(tightDeadline, [farReceiver], now).length === 0,
    'receiver whose ETA is past pickupDeadline should be excluded',
  );
  check(
    rankReceivers(looseDeadline, [farReceiver], now).length === 1,
    'same receiver with enough time before the deadline should be eligible (control case)',
  );

  // 3. Allocation never exceeds quantityAvailableKg.
  const donation = donationFor(new Date(now.getTime() + 180 * 60_000).toISOString(), 10);
  const candidates = [makeNgo('ngo-a', PICKUP_LAT, PICKUP_LNG), makeNgo('ngo-b', PICKUP_LAT, PICKUP_LNG)];
  const ranked = rankReceivers(donation, candidates, now);
  const allocations = allocate(donation, ranked, { 'ngo-a': 7.3, 'ngo-b': 9 });
  const allocatedKg = allocations.reduce((sum, a) => sum + a.quantityKg, 0);
  check(
    allocatedKg <= donation.quantityAvailableKg + 1e-9,
    `allocate total ${allocatedKg} kg exceeds quantityAvailableKg ${donation.quantityAvailableKg}`,
  );

  // 4. Impact formulas.
  check(mealsSaved(60) === 150, `mealsSaved(60) should be 150, got ${mealsSaved(60)}`);
  check(
    estimatedEmissionsAvoidedKg(10) === 25,
    `estimatedEmissionsAvoidedKg(10) should be 25, got ${estimatedEmissionsAvoidedKg(10)}`,
  );

  return failures;
}
