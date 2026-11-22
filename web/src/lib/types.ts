import type { LifecycleStatus } from './lifecycle';

/**
 * Roles. 'donor', 'receiver' and 'admin' are the only roles stored in
 * public.profiles and the only roles the app recognises.
 */
export type Role = 'donor' | 'receiver' | 'admin';

export type DonorType = 'restaurant' | 'caterer' | 'hotel' | 'event_organiser' | 'wedding_host';

export type VegType = 'veg' | 'non_veg' | 'mixed';

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  verified: boolean;
  anonymousPublic: boolean;
  donorType?: DonorType;
  lat?: number;
  lng?: number;
  serviceRadiusKm?: number;
  beneficiaryCapacity?: number;
  maxClaimKg?: number;
  address?: string;
}

export interface EventRecord {
  id: string;
  name: string;
  eventType: 'wedding' | 'event';
  organiserId: string;
  catererId?: string;
  eventDate: string;
}

export interface Donation {
  id: string;
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
  status: LifecycleStatus;
  quantityAvailableKg: number;
  anonymousDonor: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClaimStatus =
  | 'offered'
  | 'claimed'
  | 'rejected'
  | 'expired'
  | 'pickup_confirmed'
  | 'collected'
  | 'distributed'
  | 'cancelled';

export interface Claim {
  id: string;
  donationId: string;
  receiverId: string;
  quantityKg: number;
  status: ClaimStatus;
  claimExpiresAt: string;
  collectedKg: number;
  distributedKg: number;
  beneficiariesReached: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimelineEntry {
  id: string;
  donationId: string;
  claimId?: string;
  actorId?: string;
  fromStatus?: string;
  toStatus: string;
  note: string;
  at: string;
}

export interface Dispute {
  id: string;
  donationId: string;
  claimId?: string;
  reporterId: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt: string;
}

export interface FundingEntry {
  id: string;
  sponsorId: string;
  amountInr: number;
  date: string;
  note: string;
}

export interface SponsorProgram {
  sponsorId: string;
  organisationName: string;
  programmeName: string;
  fundingAllocationInr: number;
}

export interface AppState {
  users: User[];
  events: EventRecord[];
  donations: Donation[];
  claims: Claim[];
  timeline: TimelineEntry[];
  disputes: Dispute[];
  funding: FundingEntry[];
  sponsorPrograms: SponsorProgram[];
}
