import { collectedKg, distributedKg, donatedKg, mealsSaved } from './impact';
import type { AppState, Donation, DonorType, User } from './types';

export interface DateRange {
  start: Date;
  end: Date;
}

/** A leaderboard row with its 1-based rank, public display name and internal id. */
export type Ranked<T> = T & { rank: number; id: string; displayName: string };

export interface RestaurantMetrics {
  donatedKg: number;
  collectedKg: number;
  mealsRescued: number;
  successfulDonations: number;
}

export interface OrganiserMetrics {
  donatedKg: number;
  collectedKg: number;
  successfulEvents: number;
  mealsRescued: number;
}

export interface EventMetrics {
  organiserName: string;
  catererName: string;
  donatedKg: number;
  deliveredKg: number;
  receiversWhoCollected: string[];
  mealsRescued: number;
}

export interface ReceiverMetrics {
  collectedKg: number;
  distributedKg: number;
  successfulPickups: number;
  beneficiariesReached: number;
}

export type RestaurantRow = Ranked<RestaurantMetrics>;
export type OrganiserRow = Ranked<OrganiserMetrics>;
export type EventRow = Ranked<EventMetrics>;
export type ReceiverRow = Ranked<ReceiverMetrics>;

export interface Leaderboards {
  /** A. Restaurants, caterers and hotels. Ranked by collectedKg. */
  restaurants: RestaurantRow[];
  /** B. Event organisers. Ranked by collectedKg. */
  organisers: OrganiserRow[];
  /** C. One row per wedding/event. Ranked by deliveredKg. */
  events: EventRow[];
  /** D. NGOs and volunteers. Ranked by distributedKg. */
  receivers: ReceiverRow[];
}

const ANON_DONOR = 'Anonymous donor';
const ANON_RECEIVER = 'Anonymous receiver';

interface Entry<T> {
  id: string;
  name: string;
  anonymous: boolean;
  verifiedKg: number;
  data: T;
}

function rankEntries<T>(entries: Entry<T>[], anonLabel: string): Ranked<T>[] {
  return [...entries]
    .sort((a, b) => b.verifiedKg - a.verifiedKg || a.name.localeCompare(b.name))
    .map((e, index) => ({
      ...e.data,
      rank: index + 1,
      id: e.id,
      displayName: e.anonymous ? anonLabel : e.name,
    }));
}

const isRestaurantLike = (t: DonorType | undefined): boolean =>
  t === 'restaurant' || t === 'caterer' || t === 'hotel';

/** Name shown for a user in a public board. Missing users fall back to a placeholder. */
const publicName = (user: User | undefined, anonLabel: string, fallback: string): string => {
  if (user === undefined) return fallback;
  return user.anonymousPublic ? anonLabel : user.name;
};

/**
 * Label for a single donation's donor. A donation flagged anonymousDonor, or a donor flagged
 * anonymousPublic, shows as "Anonymous donor".
 */
export function donationDonorLabel(donation: Donation, donor: User | undefined): string {
  if (donation.anonymousDonor) return ANON_DONOR;
  return publicName(donor, ANON_DONOR, 'Unknown donor');
}

const inRange = (iso: string, range: DateRange): boolean => {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
};

/** Monday 00:00 local time through `now`. */
export function weekRange(now: Date): DateRange {
  const daysSinceMonday = (now.getDay() + 6) % 7;
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday),
    end: now,
  };
}

/** 1st of the month 00:00 local time through `now`. */
export function monthRange(now: Date): DateRange {
  return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };
}

/** Custom range from two ISO strings. Throws if either is not a valid date. */
export function customRange(startIso: string, endIso: string): DateRange {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid custom range: ${startIso} – ${endIso}`);
  }
  return { start, end };
}

/**
 * Builds the four public leaderboards. Donations are filtered by createdAt within the range.
 * Claims follow their donation. Receiver rows use claims on in-range donations.
 * Ranking uses the real name as tie-break, and anonymity is applied only to the displayed name.
 */
export function buildLeaderboards(state: AppState, range: DateRange): Leaderboards {
  const donations = state.donations.filter((d) => inRange(d.createdAt, range));
  const inRangeDonationIds = new Set(donations.map((d) => d.id));
  const claims = state.claims.filter((c) => inRangeDonationIds.has(c.donationId));
  const userById = new Map(state.users.map((u) => [u.id, u] as const));

  const claimsFor = (donationList: Donation[]) => {
    const ids = new Set(donationList.map((d) => d.id));
    return claims.filter((c) => ids.has(c.donationId));
  };

  // A. Restaurants, caterers and hotels.
  const restaurants = rankEntries<RestaurantMetrics>(
    state.users
      .filter((u) => u.role === 'donor' && isRestaurantLike(u.donorType))
      .map((u) => {
        const mine = donations.filter((d) => d.donorId === u.id);
        const cl = claimsFor(mine);
        return {
          id: u.id,
          name: u.name,
          anonymous: u.anonymousPublic,
          verifiedKg: collectedKg(cl),
          data: {
            donatedKg: donatedKg(mine),
            collectedKg: collectedKg(cl),
            mealsRescued: mealsSaved(distributedKg(cl)),
            successfulDonations: mine.filter((d) => d.status === 'completed').length,
          },
        };
      }),
    ANON_DONOR,
  );

  // B. Event organisers: donor users with donorType event_organiser, plus any organiserId on an event.
  const organiserIds = new Set<string>([
    ...state.users
      .filter((u) => u.role === 'donor' && u.donorType === 'event_organiser')
      .map((u) => u.id),
    ...state.events.map((e) => e.organiserId),
  ]);

  const isSuccessfulEvent = (eventId: string): boolean => {
    const eventDonations = donations.filter((d) => d.eventId === eventId);
    return eventDonations.length > 0 && eventDonations.every((d) => d.status === 'completed');
  };

  const organisers = rankEntries<OrganiserMetrics>(
    [...organiserIds].map((id) => {
      const user = userById.get(id);
      const myEvents = state.events.filter((e) => e.organiserId === id);
      const myEventIds = new Set(myEvents.map((e) => e.id));
      const mine = donations.filter((d) => d.eventId !== undefined && myEventIds.has(d.eventId));
      const cl = claimsFor(mine);
      return {
        id,
        name: user?.name ?? 'Unknown organiser',
        anonymous: user?.anonymousPublic ?? false,
        verifiedKg: collectedKg(cl),
        data: {
          donatedKg: donatedKg(mine),
          collectedKg: collectedKg(cl),
          successfulEvents: myEvents.filter((e) => isSuccessfulEvent(e.id)).length,
          mealsRescued: mealsSaved(distributedKg(cl)),
        },
      };
    }),
    ANON_DONOR,
  );

  // C. Weddings and events: one row per EventRecord. The event name is public, so anonymity only applies to people.
  const events = rankEntries<EventMetrics>(
    state.events.map((e) => {
      const eventDonations = donations.filter((d) => d.eventId === e.id);
      const cl = claimsFor(eventDonations);
      const receiverIds = new Set(cl.filter((c) => c.collectedKg > 0).map((c) => c.receiverId));
      const receiverLabels = [...receiverIds].map((rid) =>
        publicName(userById.get(rid), ANON_RECEIVER, 'Unknown receiver'),
      );
      const catererName =
        e.catererId === undefined
          ? ''
          : publicName(userById.get(e.catererId), ANON_DONOR, 'Unknown caterer');
      return {
        id: e.id,
        name: e.name,
        anonymous: false,
        verifiedKg: distributedKg(cl),
        data: {
          organiserName: publicName(userById.get(e.organiserId), ANON_DONOR, 'Unknown organiser'),
          catererName,
          donatedKg: donatedKg(eventDonations),
          deliveredKg: distributedKg(cl),
          receiversWhoCollected: Array.from(new Set(receiverLabels)).sort((a, b) =>
            a.localeCompare(b),
          ),
          mealsRescued: mealsSaved(distributedKg(cl)),
        },
      };
    }),
    ANON_DONOR,
  );

  // D. NGOs and volunteers.
  const receivers = rankEntries<ReceiverMetrics>(
    state.users
      .filter((u) => u.role === 'receiver')
      .map((u) => {
        const mine = claims.filter((c) => c.receiverId === u.id);
        return {
          id: u.id,
          name: u.name,
          anonymous: u.anonymousPublic,
          verifiedKg: distributedKg(mine),
          data: {
            collectedKg: collectedKg(mine),
            distributedKg: distributedKg(mine),
            successfulPickups: mine.filter(
              (c) => c.status === 'collected' || c.status === 'distributed' || c.distributedKg > 0,
            ).length,
            beneficiariesReached: mine.reduce((sum, c) => sum + c.beneficiariesReached, 0),
          },
        };
      }),
    ANON_RECEIVER,
  );

  return { restaurants, organisers, events, receivers };
}
