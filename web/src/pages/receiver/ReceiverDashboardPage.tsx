import { useEffect, useState, type ReactNode } from 'react';
import AppShell from '../../components/AppShell';
import { useAppState } from '../../lib/AppStateContext';
import * as actions from '../../lib/actions';
import { haversineKm } from '../../lib/geo';
import type { DonorDonation } from '../../lib/donorApi';
import {
  claimDonation,
  listAvailableDonations,
  listMyFoodRequests,
  subscribeToClaimUpdates,
  type ReceiverRequest,
} from '../../lib/receiverApi';
import type { AppState, Claim, ClaimStatus, Donation, TimelineEntry, User } from '../../lib/types';

type RunAction = (key: string, apply: (s: AppState, at: Date) => AppState) => void;

const REJECT_REASONS: readonly string[] = [
  'Not enough storage space',
  'Pickup time does not work',
  'Quantity too large',
  'Food not suitable',
  'Other',
];

const BTN =
  'rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50';
const BTN_GHOST =
  'rounded-lg border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-700 hover:bg-primary-50';
const INPUT = 'rounded-lg border border-primary-200 bg-offwhite px-3 py-2 text-sm text-ink';
const CARD = 'rounded-2xl border border-primary-100 bg-white p-5 shadow-sm';

const ACTIVE_STATUSES: readonly ClaimStatus[] = ['claimed', 'pickup_confirmed', 'collected'];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function distanceFromMe(me: User, donation: Donation): number | null {
  if (me.lat === undefined || me.lng === undefined) return null;
  return haversineKm(me.lat, me.lng, donation.pickupLat, donation.pickupLng);
}


function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink/60">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  if (message === '') return null;
  return (
    <p role="alert" className="mt-2 text-sm text-red-700">
      {message}
    </p>
  );
}

interface OfferCardProps {
  claim: Claim;
  donation: Donation;
  me: User;
  now: Date;
  error: string;
  run: RunAction;
}

function OfferCard({ claim, donation, me, now, error, run }: OfferCardProps) {
  const [reason, setReason] = useState<string>(REJECT_REASONS[0] ?? 'Other');
  const key = `offer:${claim.id}`;
  const info = actions.claimDeadlineInfo(claim, now);
  const distance = distanceFromMe(me, donation);

  return (
    <article className={CARD}>
      <h3 className="text-lg font-semibold text-ink">{donation.foodName}</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Detail label="Quantity" value={`${claim.quantityKg} kg`} />
        <Detail label="Pickup deadline" value={formatDateTime(donation.pickupDeadline)} />
        <Detail label="Distance" value={distance === null ? 'Unknown' : `${distance.toFixed(1)} km`} />
        <Detail label="Storage" value={donation.storageCondition || 'Not stated'} />
        <Detail label="Allergens" value={donation.allergens || 'None stated'} />
        <Detail label="Prep time" value={donation.prepTimeAt || 'Not stated'} />
        <Detail label="Veg type" value={donation.vegType.replace('_', '-')} />
        <Detail
          label="Time to claim"
          value={info.overdueDeadline ? 'Hold lapsed' : `${info.minutesLeft} min left`}
        />
      </dl>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <button
          type="button"
          className={BTN}
          onClick={() => run(key, (s, at) => actions.claimOffer(s, claim.id, me.id, at))}
        >
          Claim
        </button>
        <label className="flex flex-col text-sm text-ink">
          Reason to reject
          <select className={INPUT} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REJECT_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BTN_GHOST}
          onClick={() => run(key, (s, at) => actions.rejectOffer(s, claim.id, me.id, reason, at))}
        >
          Reject
        </button>
      </div>
      <ErrorLine message={error} />
    </article>
  );
}

interface BrowseCardProps {
  donation: DonorDonation;
  claiming: boolean;
  claimError: string;
  onConfirm: (quantity: number, message: string) => Promise<boolean>;
}

function BrowseCard({ donation, claiming, claimError, onConfirm }: BrowseCardProps) {
  const remaining = donation.remaining_quantity ?? donation.quantity;
  const fullyClaimed = remaining <= 0 || donation.status !== 'available';
  const [promptOpen, setPromptOpen] = useState<boolean>(false);
  const [qtyInput, setQtyInput] = useState<string>('');
  const [messageInput, setMessageInput] = useState<string>('');
  const [localError, setLocalError] = useState<string>('');

  const openPrompt = (): void => {
    setQtyInput(String(remaining));
    setMessageInput('');
    setLocalError('');
    setPromptOpen(true);
  };

  const confirm = async (): Promise<void> => {
    const qty = Number(qtyInput);
    if (qtyInput.trim() === '' || !Number.isFinite(qty) || qty <= 0) {
      setLocalError('Enter a quantity greater than 0.');
      return;
    }
    if (qty > remaining) {
      setLocalError(`You can claim at most ${remaining} ${donation.unit}.`);
      return;
    }
    setLocalError('');
    const ok = await onConfirm(qty, messageInput);
    if (ok) setPromptOpen(false);
  };

  return (
    <article className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{donation.title}</h3>
        <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
          {remaining} {donation.unit} remaining of {donation.quantity} {donation.unit}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3">
        <Detail label="Quantity" value={`${donation.quantity} ${donation.unit}`} />
        <Detail label="Serves about" value={`${donation.estimated_people} people`} />
        <Detail
          label="Pickup window"
          value={`${formatDateTime(donation.pickup_window_start)} – ${formatDateTime(donation.pickup_window_end)}`}
        />
        <Detail label="Expires" value={formatDateTime(donation.expires_at)} />
        <Detail label="Pickup address" value={`${donation.pickup_address}, ${donation.pickup_city}`} />
        <Detail label="Vegetarian" value={donation.is_vegetarian ? 'Yes' : 'No'} />
        <Detail label="Special instructions" value={donation.special_instructions || 'None stated'} />
      </dl>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {fullyClaimed ? (
          <span className="text-sm font-semibold text-ink/70">Fully claimed</span>
        ) : !promptOpen ? (
          <button
            type="button"
            className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
            onClick={openPrompt}
          >
            Claim Food
          </button>
        ) : (
          <>
            <label className="flex flex-col text-sm text-ink">
              Quantity ({donation.unit})
              <input
                type="number"
                min="0"
                step="any"
                max={remaining}
                className={INPUT}
                value={qtyInput}
                onChange={(e) => setQtyInput(e.target.value)}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col text-sm text-ink">
              Message (optional)
              <input
                type="text"
                className={INPUT}
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50"
              disabled={claiming}
              onClick={() => void confirm()}
            >
              {claiming ? 'Claiming…' : 'Confirm'}
            </button>
            <button
              type="button"
              className={BTN_GHOST}
              disabled={claiming}
              onClick={() => setPromptOpen(false)}
            >
              Cancel
            </button>
          </>
        )}
      </div>
      <ErrorLine message={localError !== '' ? localError : claimError} />
    </article>
  );
}

interface ActiveRowProps {
  claim: Claim;
  donation: Donation;
  receiverId: string;
  error: string;
  run: RunAction;
}

function ActiveRow({ claim, donation, receiverId, error, run }: ActiveRowProps) {
  const [collectedInput, setCollectedInput] = useState('');
  const [distributedInput, setDistributedInput] = useState('');
  const [beneficiariesInput, setBeneficiariesInput] = useState('');
  const key = `pickup:${claim.id}`;

  return (
    <article className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{donation.foodName}</h3>
        <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
          {claim.status.replace(/_/g, ' ')}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink">
        {claim.quantityKg} kg · pickup by {formatDateTime(donation.pickupDeadline)} · {donation.pickupAddress}
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        {claim.status === 'claimed' && (
          <button
            type="button"
            className={BTN}
            onClick={() => run(key, (s, at) => actions.confirmPickup(s, claim.id, receiverId, at))}
          >
            Confirm pickup
          </button>
        )}
        {claim.status === 'pickup_confirmed' && (
          <>
            <label className="flex flex-col text-sm text-ink">
              Collected kg
              <input
                type="number"
                min="0"
                step="0.1"
                className={INPUT}
                value={collectedInput}
                onChange={(e) => setCollectedInput(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={BTN}
              onClick={() =>
                run(key, (s, at) => actions.recordCollection(s, claim.id, receiverId, Number(collectedInput), at))
              }
            >
              Record collected
            </button>
          </>
        )}
        {claim.status === 'collected' && (
          <>
            <label className="flex flex-col text-sm text-ink">
              Distributed kg
              <input
                type="number"
                min="0"
                step="0.1"
                className={INPUT}
                value={distributedInput}
                onChange={(e) => setDistributedInput(e.target.value)}
              />
            </label>
            <label className="flex flex-col text-sm text-ink">
              Beneficiaries reached
              <input
                type="number"
                min="0"
                step="1"
                className={INPUT}
                value={beneficiariesInput}
                onChange={(e) => setBeneficiariesInput(e.target.value)}
              />
            </label>
            <button
              type="button"
              className={BTN}
              onClick={() =>
                run(key, (s, at) =>
                  actions.recordDistribution(
                    s,
                    claim.id,
                    receiverId,
                    Number(distributedInput),
                    Number(beneficiariesInput),
                    at,
                  ),
                )
              }
            >
              Record distribution
            </button>
          </>
        )}
      </div>
      <ErrorLine message={error} />
    </article>
  );
}

interface HistoryRowProps {
  claim: Claim;
  donation: Donation;
  entries: TimelineEntry[];
  receiverId: string;
  error: string;
  run: RunAction;
}

function HistoryRow({ claim, donation, entries, receiverId, error, run }: HistoryRowProps) {
  const [issueText, setIssueText] = useState('');
  const key = `issue:${claim.id}`;

  return (
    <article className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-ink">{donation.foodName}</h3>
        <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
          {claim.status.replace(/_/g, ' ')}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Detail label="Claimed" value={`${claim.quantityKg} kg`} />
        <Detail label="Collected" value={`${claim.collectedKg} kg`} />
        <Detail label="Distributed" value={`${claim.distributedKg} kg`} />
        <Detail label="Beneficiaries reached" value={String(claim.beneficiariesReached)} />
      </dl>

      <div className="mt-4">
        <p className="text-sm font-semibold text-ink">Recent timeline</p>
        {entries.length === 0 ? (
          <p className="text-sm text-ink/70">No timeline entries yet.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm text-ink">
            {entries.map((t) => (
              <li key={t.id}>
                <span className="text-ink/60">{formatDateTime(t.at)}</span> · {t.toStatus.replace(/_/g, ' ')} · {t.note}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col text-sm text-ink">
          Report an issue
          <input
            type="text"
            className={INPUT}
            placeholder="Describe the problem"
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={BTN_GHOST}
          onClick={() =>
            run(key, (s, at) => actions.reportIssue(s, claim.donationId, claim.id, receiverId, issueText, at))
          }
        >
          Report
        </button>
      </div>
      <ErrorLine message={error} />
    </article>
  );
}

export default function ReceiverDashboardPage() {
  const { state, setState, currentUser } = useAppState();
  const [now, setNow] = useState<Date>(() => new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const meId = currentUser?.role === 'receiver' ? currentUser.id : null;
  const [available, setAvailable] = useState<DonorDonation[]>([]);
  const [myRequests, setMyRequests] = useState<ReceiverRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string>('');
  const [reloadTick, setReloadTick] = useState<number>(0);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<{ id: string; message: string } | null>(null);

  // Load available donations and this receiver's own requests from Supabase on mount and after each claim.
  useEffect(() => {
    if (meId === null) return;
    let cancelled = false;
    setLoadError('');
    Promise.all([listAvailableDonations(), listMyFoodRequests(meId)])
      .then(([donations, requests]) => {
        if (cancelled) return;
        setAvailable(donations);
        setMyRequests(requests);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : 'Could not load food right now. Please try again.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [meId, reloadTick]);

  // Poll every 15 seconds in case realtime is disabled, and reload whenever donations or food_requests change.
  useEffect(() => {
    if (meId === null) return;
    const bump = (): void => setReloadTick((t) => t + 1);
    const pollId = window.setInterval(bump, 15_000);
    const unsubscribe = subscribeToClaimUpdates(bump);
    return () => {
      window.clearInterval(pollId);
      unsubscribe();
    };
  }, [meId]);

  const handleClaim = async (donationId: string, quantity: number, message: string): Promise<boolean> => {
    setClaimingId(donationId);
    setClaimError(null);
    try {
      await claimDonation(donationId, quantity, message);
      setReloadTick((t) => t + 1);
      return true;
    } catch (err) {
      setClaimError({
        id: donationId,
        message: err instanceof Error ? err.message : 'Could not claim this food. Please try again.',
      });
      return false;
    } finally {
      setClaimingId(null);
    }
  };



  // Expire overdue offers and claims every 30 seconds. Commit only when claims or donations changed.
  useEffect(() => {
    const tick = (): void => {
      const current = new Date();
      setNow(current);
      setState((s) => {
        const next = actions.expireOverdueClaims(s, current);
        const unchanged =
          JSON.stringify(next.claims) === JSON.stringify(s.claims) &&
          JSON.stringify(next.donations) === JSON.stringify(s.donations);
        return unchanged ? s : next;
      });
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [setState]);

  if (!currentUser || currentUser.role !== 'receiver') {
    return (
      <AppShell title="Receiver dashboard">
        <p className="mt-8 text-ink">
          This dashboard is for NGO and volunteer receivers. Please sign in with a receiver account.
        </p>
      </AppShell>
    );
  }

  const me = currentUser;

  const run: RunAction = (key, apply) => {
    const at = new Date();
    try {
      const next = apply(state, at);
      setState(() => next);
      setErrors((prev) => ({ ...prev, [key]: '' }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrors((prev) => ({ ...prev, [key]: message }));
    }
  };

  const errorFor = (key: string): string => errors[key] ?? '';

  const myClaims = state.claims.filter((c) => c.receiverId === me.id);

  const withDonation = (claims: Claim[]): { claim: Claim; donation: Donation }[] =>
    claims.flatMap((claim) => {
      const donation = state.donations.find((d) => d.id === claim.donationId);
      return donation ? [{ claim, donation }] : [];
    });

  const offers = withDonation(myClaims.filter((c) => c.status === 'offered'));
  const active = withDonation(myClaims.filter((c) => ACTIVE_STATUSES.includes(c.status)));


  const history = withDonation(myClaims).map(({ claim, donation }) => ({
    claim,
    donation,
    entries: state.timeline
      .filter((t) => t.donationId === donation.id)
      .slice(-10)
      .reverse(),
  }));

  // Verified totals only: successful pickups (collected or distributed) with recorded kg.
  const successful = myClaims.filter((c) => c.status === 'collected' || c.status === 'distributed');
  const totalCollected = successful.reduce((sum, c) => sum + c.collectedKg, 0);
  const totalDistributed = successful.reduce((sum, c) => sum + c.distributedKg, 0);
  const totalBeneficiaries = successful.reduce((sum, c) => sum + c.beneficiariesReached, 0);

  return (
    <AppShell title="Receiver dashboard">
      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-xl font-bold text-ink">Offers for you</h2>
          {offers.length === 0 ? (
            <p className="text-sm text-ink/70">No offers right now. New matches will appear here.</p>
          ) : (
            <div className="grid gap-4">
              {offers.map(({ claim, donation }) => (
                <OfferCard
                  key={claim.id}
                  claim={claim}
                  donation={donation}
                  me={me}
                  now={now}
                  error={errorFor(`offer:${claim.id}`)}
                  run={run}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-xl font-bold text-ink">Browse nearby</h2>
          {loading ? (
            <p className="text-sm text-ink/70">Loading available food…</p>
          ) : loadError !== '' ? (
            <ErrorLine message={loadError} />
          ) : available.length === 0 ? (
            <p className="text-sm text-ink/70">No food available right now.</p>
          ) : (
            <div className="grid gap-4">
              {available.map((donation) => (
                <BrowseCard
                  key={donation.id}
                  donation={donation}
                  claiming={claimingId === donation.id}
                  claimError={claimError?.id === donation.id ? claimError.message : ''}
                  onConfirm={(quantity, message) => handleClaim(donation.id, quantity, message)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Section title="My food requests">
        {loading ? (
          <p className="text-sm text-ink/70">Loading your requests…</p>
        ) : myRequests.length === 0 ? (
          <p className="text-sm text-ink/70">You have not requested any food yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {myRequests.map((r) => (
              <article key={r.id} className={CARD}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-ink">{r.donation?.title ?? 'Donation'}</h3>
                  <span className="rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
                    {r.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-ink">
                  Quantity {r.requested_quantity ?? '—'} {r.donation?.unit ?? ''} · Requested{' '}
                  {formatDateTime(r.created_at)}
                </p>
              </article>
            ))}
          </div>
        )}
      </Section>


      <Section title="My active pickups">
        <p className="mb-4 text-sm text-ink/80">
          Pickups are arranged and performed by you. ResQMeal does not assign delivery partners. Food safety is not
          certified by ResQMeal; you may reject any food.
        </p>
        {active.length === 0 ? (
          <p className="text-sm text-ink/70">You have no active pickups.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {active.map(({ claim, donation }) => (
              <ActiveRow
                key={claim.id}
                claim={claim}
                donation={donation}
                receiverId={me.id}
                error={errorFor(`pickup:${claim.id}`)}
                run={run}
              />
            ))}
          </div>
        )}
      </Section>

      <Section title="My impact">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={CARD}>
            <p className="text-sm text-ink/70">Collected</p>
            <p className="text-2xl font-bold text-ink">{totalCollected.toFixed(1)} kg</p>
          </div>
          <div className={CARD}>
            <p className="text-sm text-ink/70">Distributed</p>
            <p className="text-2xl font-bold text-ink">{totalDistributed.toFixed(1)} kg</p>
          </div>
          <div className={CARD}>
            <p className="text-sm text-ink/70">Successful pickups</p>
            <p className="text-2xl font-bold text-ink">{successful.length}</p>
          </div>
          <div className={CARD}>
            <p className="text-sm text-ink/70">Beneficiaries reached</p>
            <p className="text-2xl font-bold text-ink">{totalBeneficiaries}</p>
          </div>
          <div className={CARD}>
            <p className="text-sm text-ink/70">Capacity</p>
            {me.role === 'receiver' ? (
              <p className="text-2xl font-bold text-ink">{me.beneficiaryCapacity ?? 0} beneficiaries</p>
            ) : (
              <p className="text-2xl font-bold text-ink">
                {me.maxClaimKg ?? 0} kg max claim · {me.serviceRadiusKm ?? 0} km radius
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="History">
        {history.length === 0 ? (
          <p className="text-sm text-ink/70">No claims yet.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {history.map(({ claim, donation, entries }) => (
              <HistoryRow
                key={claim.id}
                claim={claim}
                donation={donation}
                entries={entries}
                receiverId={me.id}
                error={errorFor(`issue:${claim.id}`)}
                run={run}
              />
            ))}
          </div>
        )}
      </Section>
    </AppShell>
  );
}
