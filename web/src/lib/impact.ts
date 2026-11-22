import type { Claim, Donation } from './types';

/**
 * Meals saved = verified edible food distributed (kg) ÷ MEALS_DIVISOR_KG.
 * Planning assumption: 1 meal ≈ 0.4 kg of cooked food.
 */
export const MEALS_DIVISOR_KG = 0.4;

/**
 * Configurable placeholder: estimated kg CO2e avoided per kg of food rescued.
 * This is an ESTIMATE, not a measured reduction. Change it here when a sourced factor is agreed.
 */
export const EMISSIONS_FACTOR_KGCO2E_PER_KG = 2.5;

/**
 * Meals saved from verified distributed food.
 * Formula: floor(distributedKg ÷ MEALS_DIVISOR_KG).
 * The value is rounded to 6 decimals first so float noise (e.g. 149.9999999) cannot drop a meal.
 */
export function mealsSaved(distributedKg: number): number {
  return Math.floor(Number((distributedKg / MEALS_DIVISOR_KG).toFixed(6)));
}

/**
 * Estimated emissions avoided from DISTRIBUTED food only (kg CO2e, 1 decimal).
 * Formula: distributedKg × EMISSIONS_FACTOR_KGCO2E_PER_KG. This is an estimate.
 */
export function estimatedEmissionsAvoidedKg(distributedKg: number): number {
  return Math.round(distributedKg * EMISSIONS_FACTOR_KGCO2E_PER_KG * 10) / 10;
}

/**
 * Donated kg: sum of quantityKg over donations that were not cancelled or expired.
 * Posted or unmatched food is counted as donated, never as rescued.
 */
export function donatedKg(donations: Donation[]): number {
  return donations
    .filter((d) => d.status !== 'cancelled' && d.status !== 'expired')
    .reduce((sum, d) => sum + d.quantityKg, 0);
}

/**
 * Collected kg: sum of collectedKg over claims where food was actually collected (collectedKg > 0).
 * Claimed-only food (no collection recorded) contributes nothing.
 */
export function collectedKg(claims: Claim[]): number {
  return claims
    .filter((c) => c.collectedKg > 0)
    .reduce((sum, c) => sum + c.collectedKg, 0);
}

/** Distributed kg: sum of distributedKg over claims (verified distribution only). */
export function distributedKg(claims: Claim[]): number {
  return claims.reduce((sum, c) => sum + c.distributedKg, 0);
}
