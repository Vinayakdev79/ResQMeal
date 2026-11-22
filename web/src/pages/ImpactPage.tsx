import 'leaflet/dist/leaflet.css';
import { useMemo, useState, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Award, HeartHandshake, History, Leaf, MapPin, Package, Scale, Soup, Sparkles, Truck, Users, Utensils } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppShell from '../components/AppShell';
import { Podium, type PodiumEntry } from '../components/Podium';
import { StatCard } from '../components/ui';
import { useAppState } from '../lib/AppStateContext';
import { LIFECYCLE_LABELS } from '../lib/lifecycle';
import {
  collectedKg as sumCollectedKg,
  distributedKg as sumDistributedKg,
  donatedKg as sumDonatedKg,
  estimatedEmissionsAvoidedKg,
  MEALS_DIVISOR_KG,
  mealsSaved,
} from '../lib/impact';
import { buildLeaderboards, customRange, monthRange, weekRange } from '../lib/leaderboard';
import type { DateRange } from '../lib/leaderboard';
import type { AppState, Claim, ClaimStatus, Donation } from '../lib/types';

type RangeMode = 'weekly' | 'monthly' | 'custom';

const MODE_OPTIONS: readonly { value: RangeMode; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

const MAP_CENTER: [number, number] = [27.4924, 77.6737];
const MAP_ZOOM = 12;
const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Forest and sage chart palette (hex is required by recharts and Leaflet path options).
const COLOR_FOREST = '#173F35';
const COLOR_FOREST_MID = '#4E8A79';
const COLOR_SAGE = '#A8B9A3';
const COLOR_INK = '#252B28';
const AXIS_TICK = { fontSize: 11, fill: '#5C645F' };

const CLAIM_LABELS: Record<ClaimStatus, string> = {
  offered: 'Offered',
  claimed: 'Claimed',
  rejected: 'Rejected',
  expired: 'Expired',
  pickup_confirmed: 'Pickup confirmed',
  collected: 'Collected',
  distributed: 'Distributed',
  cancelled: 'Cancelled',
};

type BoardKey = 'restaurants' | 'organisers' | 'events' | 'receivers';

interface Selection {
  board: BoardKey;
  id: string;
  name: string;
}

interface HistoryRow {
  id: string;
  food: string;
  at: string;
  status: string;
  amount: string;
}

interface ResolvedRange {
  range: DateRange;
  error: string | null;
}

interface HeadlineCard {
  label: string;
  value: string;
  note?: string;
  icon: LucideIcon;
}

function toInputDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

function kgText(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function resolveRange(mode: RangeMode, startDate: string, endDate: string): ResolvedRange {
  const now = new Date();
  if (mode === 'weekly') return { range: weekRange(now), error: null };
  if (mode === 'monthly') return { range: monthRange(now), error: null };
  if (startDate === '' || endDate === '' || endDate < startDate) {
    return {
      range: monthRange(now),
      error: 'Choose a start and end date (end on or after start). Showing this month instead.',
    };
  }
  return {
    range: customRange(`${startDate}T00:00:00`, `${endDate}T23:59:59.999`),
    error: null,
  };
}

/** Recognition chips from verified kg and successful-pickup count. Computed from state only. */
function badgesFor(verifiedKg: number, successes: number): string[] {
  const chips: string[] = [];
  if (verifiedKg >= 100) chips.push('100 kg verified');
  if (verifiedKg >= 500) chips.push('500 kg verified');
  if (successes >= 1) chips.push('First verified pickup');
  return chips;
}

function BoardCard({
  title,
  subtitle,
  icon: Icon,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  empty: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-7">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
      </div>
      <div className="mt-6">
        {empty ? (
          <p className="rounded-xl bg-cream p-4 text-sm text-muted">No verified activity in this range yet.</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function NameButton({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left font-semibold text-forest-700 underline-offset-2 hover:underline"
    >
      {name}
    </button>
  );
}

function ChartFrame({ children }: { children: ReactNode }) {
  return <div className="mt-8 h-72 rounded-2xl bg-cream p-4">{children}</div>;
}

function historyFor(
  selection: Selection,
  state: AppState,
  donations: Donation[],
  claims: Claim[],
): HistoryRow[] {
  if (selection.board === 'receivers') {
    const donationById = new Map(state.donations.map((d) => [d.id, d] as const));
    return claims
      .filter((c) => c.receiverId === selection.id)
      .map((c) => ({
        id: c.id,
        food: donationById.get(c.donationId)?.foodName ?? 'Unknown food',
        at: c.updatedAt,
        status: CLAIM_LABELS[c.status],
        amount: `${kgText(c.collectedKg)} collected, ${kgText(c.distributedKg)} distributed`,
      }));
  }

  let mine: Donation[];
  if (selection.board === 'restaurants') {
    mine = donations.filter((d) => d.donorId === selection.id);
  } else if (selection.board === 'organisers') {
    const eventIds = new Set(
      state.events.filter((e) => e.organiserId === selection.id).map((e) => e.id),
    );
    mine = donations.filter((d) => d.eventId !== undefined && eventIds.has(d.eventId));
  } else {
    mine = donations.filter((d) => d.eventId === selection.id);
  }

  return mine.map((d) => ({
    id: d.id,
    food: d.foodName,
    at: d.createdAt,
    status: LIFECYCLE_LABELS[d.status],
    amount: kgText(d.quantityKg),
  }));
}

export default function ImpactPage() {
  const { state } = useAppState();
  const [mode, setMode] = useState<RangeMode>('monthly');
  const [startDate, setStartDate] = useState<string>(() => toInputDate(monthRange(new Date()).start));
  const [endDate, setEndDate] = useState<string>(() => toInputDate(new Date()));
  const [selection, setSelection] = useState<Selection | null>(null);

  const { range, error } = useMemo(
    () => resolveRange(mode, startDate, endDate),
    [mode, startDate, endDate],
  );

  const donations = useMemo(
    () => state.donations.filter((d) => inRange(d.createdAt, range)),
    [state.donations, range],
  );

  const claims = useMemo(() => {
    const ids = new Set(donations.map((d) => d.id));
    return state.claims.filter((c) => ids.has(c.donationId));
  }, [state.claims, donations]);

  const boards = useMemo(() => buildLeaderboards(state, range), [state, range]);

  const userById = useMemo(() => new Map(state.users.map((u) => [u.id, u] as const)), [state.users]);

  const donated = sumDonatedKg(donations);
  const collected = sumCollectedKg(claims);
  const distributed = sumDistributedKg(claims);
  const meals = mealsSaved(distributed);
  const emissions = estimatedEmissionsAvoidedKg(distributed);

  const statCards: HeadlineCard[] = [
    { label: 'Donated', value: kgText(donated), note: 'Posted food, excluding cancelled and expired', icon: Package },
    { label: 'Collected', value: kgText(collected), note: 'Recorded at pickup', icon: Truck },
    { label: 'Distributed', value: kgText(distributed), note: 'Verified distribution', icon: Scale },
    {
      label: 'Meals saved',
      value: meals.toLocaleString(),
      note: `Meals saved = verified distributed kg ÷ ${MEALS_DIVISOR_KG} kg`,
      icon: Soup,
    },
    {
      label: 'Estimated emissions avoided',
      value: `${emissions} kg CO₂e`,
      note: 'Estimate, not a measured reduction',
      icon: Leaf,
    },
  ];

  const restaurantChart = boards.restaurants.map((r) => ({ name: r.displayName, collected: r.collectedKg }));
  const receiverChart = boards.receivers.map((r) => ({ name: r.displayName, distributed: r.distributedKg }));

  const badgeRows = [
    ...boards.restaurants.map((r) => ({
      key: `a-${r.id}`,
      name: r.displayName,
      chips: badgesFor(r.collectedKg, r.successfulDonations),
    })),
    ...boards.receivers.map((r) => ({
      key: `d-${r.id}`,
      name: r.displayName,
      chips: badgesFor(r.distributedKg, r.successfulPickups),
    })),
  ].filter((row) => row.chips.length > 0);

  const history = selection === null ? [] : historyFor(selection, state, donations, claims);

  const restaurantPodium: PodiumEntry[] = boards.restaurants.slice(0, 3).map((r) => ({
    id: r.id,
    rank: r.rank,
    name: r.displayName,
    metric: `${kgText(r.collectedKg)} verified`,
    stats: [
      { label: 'Successful donations', value: String(r.successfulDonations) },
      { label: 'Collected', value: kgText(r.collectedKg) },
    ],
    onSelect: () => setSelection({ board: 'restaurants', id: r.id, name: r.displayName }),
  }));

  const organiserPodium: PodiumEntry[] = boards.organisers.slice(0, 3).map((r) => ({
    id: r.id,
    rank: r.rank,
    name: r.displayName,
    metric: `${kgText(r.collectedKg)} verified`,
    onSelect: () => setSelection({ board: 'organisers', id: r.id, name: r.displayName }),
  }));

  const eventPodium: PodiumEntry[] = boards.events.slice(0, 3).map((r) => ({
    id: r.id,
    rank: r.rank,
    name: r.displayName,
    metric: `${kgText(r.deliveredKg)} delivered`,
    stats: [
      { label: 'Organiser', value: r.organiserName },
      { label: 'Donated', value: kgText(r.donatedKg) },
      { label: 'Meals rescued', value: r.mealsRescued.toLocaleString() },
    ],
    onSelect: () => setSelection({ board: 'events', id: r.id, name: r.displayName }),
  }));

  const receiverPodium: PodiumEntry[] = boards.receivers.slice(0, 3).map((r) => ({
    id: r.id,
    rank: r.rank,
    name: r.displayName,
    metric: `${kgText(r.distributedKg)} verified`,
    stats: [
      { label: 'Successful pickups', value: String(r.successfulPickups) },
      { label: 'Distributed', value: kgText(r.distributedKg) },
    ],
    onSelect: () => setSelection({ board: 'receivers', id: r.id, name: r.displayName }),
  }));

  return (
    <AppShell title="Impact & Recognition">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <header className="reveal flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-600">Verified impact</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-charcoal md:text-4xl">
            Impact & recognition
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Figures use verified kilograms and successful pickups for the selected date range. Estimates are labelled as
            such.
          </p>
        </header>

        {/* Range filter */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Date range">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => setMode(option.value)}
                className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                  mode === option.value
                    ? 'border-forest-700 bg-forest-700 text-cream'
                    : 'border-line bg-surface text-charcoal hover:border-forest-700 hover:text-forest-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {mode === 'custom' && (
            <div className="mt-4 flex flex-wrap gap-4">
              <label className="flex flex-col text-sm font-medium">
                Start
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 rounded-xl border border-line bg-surface px-3 py-2 text-charcoal focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-200"
                />
              </label>
              <label className="flex flex-col text-sm font-medium">
                End
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 rounded-xl border border-line bg-surface px-3 py-2 text-charcoal focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-200"
                />
              </label>
            </div>
          )}
          {error !== null && <p className="mt-3 text-sm text-danger-700">{error}</p>}
        </section>

        {/* Headline stats */}
        <section aria-label="Headline impact">
          <ul className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map((card) => (
              <li key={card.label} className="h-full">
                <StatCard
                  label={card.label}
                  value={card.value}
                  hint={card.note}
                  icon={card.icon}
                  className="h-full"
                />
              </li>
            ))}
          </ul>
        </section>

        {/* A. Restaurants and caterers */}
        <BoardCard
          title="A. Top Restaurants & Caterers"
          subtitle="Ranked by collected kg from in-range donations."
          icon={Utensils}
          empty={boards.restaurants.length === 0}
        >
          <Podium entries={restaurantPodium} />
          <ol className="mt-6 divide-y divide-line">
            {boards.restaurants.slice(3).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 font-display text-sm font-semibold text-muted">#{r.rank}</span>
                  <NameButton
                    name={r.displayName}
                    onClick={() => setSelection({ board: 'restaurants', id: r.id, name: r.displayName })}
                  />
                </div>
                <span className="text-sm font-semibold text-charcoal">{kgText(r.collectedKg)} verified</span>
              </li>
            ))}
          </ol>
          <ChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={restaurantChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip />
                <Legend />
                <Bar dataKey="collected" name="Collected kg" fill={COLOR_FOREST} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </BoardCard>

        {/* B. Event organisers */}
        <BoardCard
          title="B. Top Event Organisers"
          subtitle="Ranked by collected kg across the events they organise."
          icon={Users}
          empty={boards.organisers.length === 0}
        >
          <Podium entries={organiserPodium} />
          <ol className="mt-6 divide-y divide-line">
            {boards.organisers.slice(3).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 font-display text-sm font-semibold text-muted">#{r.rank}</span>
                  <NameButton
                    name={r.displayName}
                    onClick={() => setSelection({ board: 'organisers', id: r.id, name: r.displayName })}
                  />
                </div>
                <span className="text-sm font-semibold text-charcoal">{kgText(r.collectedKg)} verified</span>
              </li>
            ))}
          </ol>
        </BoardCard>

        {/* C. Weddings and events */}
        <BoardCard
          title="C. Top Weddings & Individual Events"
          subtitle="Ranked by delivered kg for each wedding or event."
          icon={Sparkles}
          empty={boards.events.length === 0}
        >
          <Podium entries={eventPodium} />
          <ol className="mt-6 divide-y divide-line">
            {boards.events.slice(3).map((r) => (
              <li key={r.id} className="flex flex-col gap-2 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-8 font-display text-sm font-semibold text-muted">#{r.rank}</span>
                  <NameButton
                    name={r.displayName}
                    onClick={() => setSelection({ board: 'events', id: r.id, name: r.displayName })}
                  />
                </div>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-1 pl-11 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <dt className="inline text-muted">Organiser: </dt>
                    <dd className="inline text-charcoal">{r.organiserName}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Caterer: </dt>
                    <dd className="inline text-charcoal">{r.catererName === '' ? '—' : r.catererName}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Donated: </dt>
                    <dd className="inline text-charcoal">{kgText(r.donatedKg)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Delivered: </dt>
                    <dd className="inline text-charcoal">{kgText(r.deliveredKg)}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Receivers who collected: </dt>
                    <dd className="inline text-charcoal">
                      {r.receiversWhoCollected.length === 0 ? '—' : r.receiversWhoCollected.join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Meals rescued: </dt>
                    <dd className="inline text-charcoal">{r.mealsRescued.toLocaleString()}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
        </BoardCard>

        {/* D. NGOs and volunteers */}
        <BoardCard
          title="D. Top NGOs & Volunteers"
          subtitle="Ranked by distributed kg from verified claims."
          icon={HeartHandshake}
          empty={boards.receivers.length === 0}
        >
          <Podium entries={receiverPodium} />
          <ol className="mt-6 divide-y divide-line">
            {boards.receivers.slice(3).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="flex items-center gap-3">
                  <span className="w-8 font-display text-sm font-semibold text-muted">#{r.rank}</span>
                  <NameButton
                    name={r.displayName}
                    onClick={() => setSelection({ board: 'receivers', id: r.id, name: r.displayName })}
                  />
                </div>
                <span className="text-sm font-semibold text-charcoal">{kgText(r.distributedKg)} verified</span>
              </li>
            ))}
          </ol>
          <ChartFrame>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={receiverChart} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <XAxis dataKey="name" tick={AXIS_TICK} interval={0} />
                <YAxis tick={AXIS_TICK} />
                <Tooltip />
                <Legend />
                <Bar dataKey="distributed" name="Distributed kg" fill={COLOR_SAGE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </BoardCard>

        {/* Contribution history for the selected row */}
        {selection !== null && (
          <section
            aria-label="Contribution history"
            className="rounded-2xl border border-forest-700 bg-surface p-5 shadow-sm md:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
                <History className="h-5 w-5 text-forest-600" aria-hidden="true" />
                Contribution history: {selection.name}
              </h2>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="rounded-lg border border-forest-700 px-3 py-1.5 text-sm font-semibold text-forest-700 transition-colors hover:bg-forest-50"
              >
                Close
              </button>
            </div>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No records in this range.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line">
                {history.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="font-medium text-charcoal">{row.food}</span>
                    <span className="text-muted">{row.amount}</span>
                    <span className="rounded-full bg-sage-50 px-2.5 py-0.5 text-xs font-semibold text-forest-700 ring-1 ring-inset ring-sage-200">
                      {row.status}
                    </span>
                    <span className="text-xs text-muted">{new Date(row.at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Recognition badges */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
              <Award className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Recognition badges</h2>
              <p className="mt-1 text-sm text-muted">
                Earned from verified kg and successful pickups in this range.
              </p>
            </div>
          </div>
          {badgeRows.length === 0 ? (
            <p className="mt-6 rounded-xl bg-cream p-4 text-sm text-muted">No badges earned in this range yet.</p>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
              {badgeRows.map((row) => (
                <li key={row.key} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-4 py-3">
                  <span className="mr-2 text-sm font-semibold text-charcoal">{row.name}</span>
                  {row.chips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-forest-700 px-2.5 py-0.5 text-xs font-semibold text-cream"
                    >
                      {chip}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Map of pickup points */}
        <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-7">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
              <MapPin className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight">Pickup points in range</h2>
              <p className="mt-1 text-sm text-muted">
                Map data © OpenStreetMap contributors. Popups show the donor name only when it is not anonymous.
              </p>
            </div>
          </div>
          <div className="isolate mt-6 overflow-hidden rounded-2xl ring-1 ring-line">
            <MapContainer
              center={MAP_CENTER}
              zoom={MAP_ZOOM}
              scrollWheelZoom={false}
              className="h-96 w-full"
            >
              <TileLayer attribution={TILE_ATTRIBUTION} url={TILE_URL} />
              {donations.map((d) => {
                const donor = userById.get(d.donorId);
                const showDonor = donor !== undefined && !d.anonymousDonor && !donor.anonymousPublic;
                return (
                  <CircleMarker
                    key={d.id}
                    center={[d.pickupLat, d.pickupLng]}
                    radius={9}
                    pathOptions={{ color: COLOR_INK, fillColor: COLOR_FOREST_MID, fillOpacity: 0.9, weight: 2 }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{d.foodName}</p>
                        <p>Status: {LIFECYCLE_LABELS[d.status]}</p>
                        {showDonor && donor !== undefined && <p>Donor: {donor.name}</p>}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
