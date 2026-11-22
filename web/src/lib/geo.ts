const EARTH_RADIUS_KM = 6371;

/** Average road travel speed used for ETA estimates (km/h). */
export const AVERAGE_TRAVEL_KMPH = 25;

/** Buffer added to travel time for pickup handling (minutes). */
export const PICKUP_BUFFER_MINUTES = 15;

const toRadians = (deg: number): number => (deg * Math.PI) / 180;

/**
 * Great-circle distance between two coordinates in kilometres (haversine formula).
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}
