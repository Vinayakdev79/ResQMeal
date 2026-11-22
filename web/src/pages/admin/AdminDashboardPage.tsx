import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import AppShell from '../../components/AppShell';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppState } from '../../lib/AppStateContext';
import * as actions from '../../lib/actions';
import { collectedKg, distributedKg, donatedKg, mealsSaved } from '../../lib/impact';
import { buildLeaderboards, monthRange, weekRange } from '../../lib/leaderboard';
import type { DateRange } from '../../lib/leaderboard';
import { LIFECYCLE_ORDER, isOverdue } from '../../lib/lifecycle';
import type { LifecycleStatus } from '../../lib/lifecycle';
import { listAllDonations, listAllProfiles, setUserVerified } from '../../lib/adminApi';
import type { AdminDonation, AdminProfile } from '../../lib/adminApi';
import type { AppState, Claim, ClaimStatus, Dispute, Donation, Role } from '../../lib/types';

type TabKey =
  | 'Users'
  | 'Donations'
  | 'Pickups'
  | 'Disputes'
  | 'Analytics'
  | 'Sponsors'
  | 'Reports'
  | 'Leaderboards';

const TABS: readonly TabKey[] = [
  'Users',
  'Donations',
  'Pickups',
  'Disputes',
  'Analytics',
  'Sponsors',
  'Reports',
  'Leaderboards',
];

type RoleFilter = 'all' | Role;
const ROLE_FILTERS: readonly RoleFilter[] = ['all', 'donor', 'receiver', 'admin'];

/** Claims that still hold food for a receiver (not yet collected, distributed or closed). */
const OPEN_CLAIM_STATUSES: readonly ClaimStatus[] = ['offered', 'claimed', 'pickup_confirmed'];

const HOUR_MS = 60 * 60 * 1000;
const TH_CLASS = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-charcoal/70';
const TD_CLASS = 'px-3 py-2 text-sm text-charcoal';

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function inRange(iso: string, range: DateRange): boolean {
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

interface Totals {
  donatedKg: number;
  collectedKg: number;
  distributedKg: number;
  mealsSaved: number;
}

/** Impact totals for donations created in the range, with their claims. */
function totalsFor(state: AppState, range: DateRange): Totals {
  const donations = state.donations.filter((d) => inRange(d.createdAt, range));
  const ids = new Set(donations.map((d) => d.id));
  const claims = state.claims.filter((c) => ids.has(c.donationId));
  const distributed = distributedKg(claims);
  return {
    donatedKg: donatedKg(donations),
    collectedKg: collectedKg(claims),
    distributedKg: distributed,
    mealsSaved: mealsSaved(distributed),
  };
}

type AdminUserRow = {
  id: string;
  name: string;
  role: Role;
  verified: boolean;
  status: 'active' | 'suspended';
};

type AdminDonationRow = {
  id: string;
  donorId: string;
  status: LifecycleStatus;
  quantityKg: number;
  quantityAvailableKg: number;
  pickupDeadline: string;
};

/** Supabase donation status mapped to the lifecycle label the existing markup uses. */
const DONATION_STATUS_TO_LIFECYCLE: Record<AdminDonation['status'], LifecycleStatus> = {
  available: 'posted',
  claimed: 'claimed',
  pickup_scheduled: 'pickup_confirmed',
  completed: 'completed',
  expired: 'expired',
  cancelled: 'cancelled',
  removed: 'cancelled',
};

function toAdminUserRow(p: AdminProfile): AdminUserRow {
  return {
    id: p.id,
    name: p.full_name ?? p.organization_name ?? 'Unnamed',
    role: p.role,
    verified: p.is_verified,
    status: p.is_suspended ? 'suspended' : 'active',
  };
}

function toAdminDonationRow(d: AdminDonation): AdminDonationRow {
  return {
    id: d.id,
    donorId: d.donor_id,
    status: DONATION_STATUS_TO_LIFECYCLE[d.status],
    quantityKg: d.quantity,
    quantityAvailableKg: d.status === 'available' ? d.quantity : 0,
    pickupDeadline: d.expires_at,
  };
}

export default function AdminDashboardPage() {
  const { state, setState, currentUser } = useAppState();
  const [profiles, setProfiles] = useState<AdminUserRow[]>([]);
  const [donationRows, setDonationRows] = useState<AdminDonationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('Users');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [excludePublic, setExcludePublic] = useState(false);
  const [fundingSponsorId, setFundingSponsorId] = useState('');
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingNote, setFundingNote] = useState('');
  const [fundingError, setFundingError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const week = useMemo(() => weekRange(now), [now]);
  const month = useMemo(() => monthRange(now), [now]);
  const boards = useMemo(() => buildLeaderboards(state, month), [state, month]);

  const { donations, claims } = state;

  const loadAdminData = useCallback(async (): Promise<void> => {
    try {
      const [profileData, donationData] = await Promise.all([listAllProfiles(), listAllDonations()]);
      setProfiles(profileData.map(toAdminUserRow));
      setDonationRows(donationData.map(toAdminDonationRow));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load admin data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const nameOf = (userId: string): string => profiles.find((u) => u.id === userId)?.name ?? userId;

  const visibleUsers = profiles.filter((u) => roleFilter === 'all' || u.role === roleFilter);

  const onSetVerified = async (userId: string, verified: boolean): Promise<void> => {
    setVerifyError(null);
    try {
      await setUserVerified(userId, verified);
      await loadAdminData();
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Could not update verification.');
    }
  };

  const markResolved = (disputeId: string): void => {
    setState((s) => ({
      ...s,
      disputes: s.disputes.map((d): Dispute => (d.id === disputeId ? { ...d, status: 'resolved' } : d)),
    }));
  };

  const activeClaimCount = (donationId: string): number =>
    claims.filter((c) => c.donationId === donationId && OPEN_CLAIM_STATUSES.includes(c.status))
      .length;

  // Suspicious activity flags.
  const flags: string[] = [];
  for (const d of donations) {
    const hasProgress = claims.some(
      (c) => c.donationId === d.id && (c.collectedKg > 0 || c.distributedKg > 0),
    );
    if (d.status === 'cancelled' && hasProgress) {
      flags.push(`Donation ${d.id} is cancelled but has collected or distributed claims.`);
    }
    if (new Date(d.pickupDeadline).getTime() - new Date(d.createdAt).getTime() < HOUR_MS) {
      flags.push(`Donation ${d.id} has a pickup deadline less than 1 hour after it was created.`);
    }
  }
  for (const c of claims) {
    if (c.collectedKg > c.quantityKg) {
      flags.push(`Claim ${c.id} collected ${c.collectedKg} kg, more than its ${c.quantityKg} kg.`);
    }
  }

  const weekTotals = totalsFor(state, week);
  const monthTotals = totalsFor(state, month);

  const statusCounts = LIFECYCLE_ORDER.map((status: LifecycleStatus) => ({
    status,
    count: donations.filter((d) => d.status === status).length,
  }));

  const downloadCsv = (): void => {
    const header = ['id', 'donor', 'status', 'quantityKg', 'collected', 'distributed'];
    const rows = donations.map((d: Donation) => {
      const related = claims.filter((c) => c.donationId === d.id);
      return [
        d.id,
        nameOf(d.donorId),
        d.status,
        d.quantityKg,
        collectedKg(related),
        distributedKg(related),
      ];
    });
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resqmeal-platform.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const onAddFunding = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (fundingSponsorId === '') {
      setFundingError('Choose a sponsor.');
      return;
    }
    const amount = Number(fundingAmount);
    try {
      const next = actions.addFunding(state, fundingSponsorId, amount, fundingNote, new Date());
      setState(() => next);
      setFundingError(null);
      setFundingAmount('');
      setFundingNote('');
    } catch (err) {
      setFundingError(err instanceof Error ? err.message : 'Could not add funding.');
    }
  };

  const tabButton = (key: TabKey) => (
    <button
      key={key}
      type="button"
      onClick={() => setTab(key)}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        tab === key
          ? 'bg-forest-600 text-white'
          : 'bg-white text-charcoal ring-1 ring-forest-200 hover:bg-forest-50'
      }`}
    >
      {key}
    </button>
  );

  return (
    <AppShell title="Admin dashboard">
      <div className="space-y-6 bg-cream p-4 sm:p-6">
        <div className="rounded-lg border border-forest-300 bg-forest-50 px-4 py-3 text-sm text-charcoal">
          Synthetic demo data
        </div>

        {loading && <p className="text-sm text-charcoal/70">Loading admin data…</p>}
        {loadError !== null && (
          <p role="alert" className="text-sm text-red-700">
            {loadError}
          </p>
        )}
        {verifyError !== null && (
          <p role="alert" className="text-sm text-red-700">
            {verifyError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">{TABS.map(tabButton)}</div>

        {tab === 'Users' && (
          <section className="space-y-4">
            <label className="flex flex-col gap-1 text-sm text-charcoal sm:w-64">
              Role filter
              <select
                value={roleFilter}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setRoleFilter(e.target.value as RoleFilter)
                }
                className="rounded-md border border-forest-200 bg-white px-3 py-2"
              >
                {ROLE_FILTERS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <div className="overflow-x-auto rounded-lg bg-white ring-1 ring-forest-100">
              <table className="min-w-full divide-y divide-forest-100">
                <thead className="bg-forest-50">
                  <tr>
                    <th className={TH_CLASS}>Name</th>
                    <th className={TH_CLASS}>Role</th>
                    <th className={TH_CLASS}>Verified</th>
                    <th className={TH_CLASS}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-50">
                  {visibleUsers.map((u) => {
                    const locked = u.role === 'admin' || u.id === currentUser?.id;
                    return (
                      <tr key={u.id}>
                        <td className={TD_CLASS}>{u.name}</td>
                        <td className={TD_CLASS}>{u.role}</td>
                        <td className={TD_CLASS}>{u.verified ? 'Yes' : 'No'}</td>
                        <td className={TD_CLASS}>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => void onSetVerified(u.id, true)}
                              className="rounded-md bg-forest-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => void onSetVerified(u.id, false)}
                              className="rounded-md bg-white px-3 py-1 text-xs font-medium text-charcoal ring-1 ring-forest-200 disabled:opacity-40"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === 'Donations' && (
          <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-forest-100">
            <table className="min-w-full divide-y divide-forest-100">
              <thead className="bg-forest-50">
                <tr>
                  <th className={TH_CLASS}>Status</th>
                  <th className={TH_CLASS}>Donor</th>
                  <th className={TH_CLASS}>Quantity (kg)</th>
                  <th className={TH_CLASS}>Available (kg)</th>
                  <th className={TH_CLASS}>Pickup deadline</th>
                  <th className={TH_CLASS}>Overdue</th>
                  <th className={TH_CLASS}>Active claims</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {donationRows.map((d) => (
                  <tr key={d.id}>
                    <td className={TD_CLASS}>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className={TD_CLASS}>{nameOf(d.donorId)}</td>
                    <td className={TD_CLASS}>{d.quantityKg}</td>
                    <td className={TD_CLASS}>{d.quantityAvailableKg}</td>
                    <td className={TD_CLASS}>{new Date(d.pickupDeadline).toLocaleString()}</td>
                    <td className={TD_CLASS}>
                      {isOverdue(d.pickupDeadline, now) ? 'Overdue' : 'No'}
                    </td>
                    <td className={TD_CLASS}>{activeClaimCount(d.id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Pickups' && (
          <section className="overflow-x-auto rounded-lg bg-white ring-1 ring-forest-100">
            <table className="min-w-full divide-y divide-forest-100">
              <thead className="bg-forest-50">
                <tr>
                  <th className={TH_CLASS}>Status</th>
                  <th className={TH_CLASS}>Receiver</th>
                  <th className={TH_CLASS}>Quantity (kg)</th>
                  <th className={TH_CLASS}>Collected (kg)</th>
                  <th className={TH_CLASS}>Distributed (kg)</th>
                  <th className={TH_CLASS}>Beneficiaries reached</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-forest-50">
                {claims.map((c: Claim) => (
                  <tr key={c.id}>
                    <td className={TD_CLASS}>{c.status}</td>
                    <td className={TD_CLASS}>{nameOf(c.receiverId)}</td>
                    <td className={TD_CLASS}>{c.quantityKg}</td>
                    <td className={TD_CLASS}>{c.collectedKg}</td>
                    <td className={TD_CLASS}>{c.distributedKg}</td>
                    <td className={TD_CLASS}>{c.beneficiariesReached}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Disputes' && (
          <section className="space-y-6">
            <ul className="space-y-3">
              {state.disputes.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-col gap-2 rounded-lg bg-white p-4 ring-1 ring-forest-100 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm text-charcoal">
                    <span className="font-medium">Dispute {d.id}</span> on donation {d.donationId}
                    {' · '}status {d.status}
                  </div>
                  {d.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => markResolved(d.id)}
                      className="rounded-md bg-forest-600 px-3 py-1 text-xs font-medium text-white"
                    >
                      Mark resolved
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="rounded-lg bg-white p-4 ring-1 ring-forest-100">
              <h3 className="mb-2 text-sm font-semibold text-charcoal">Suspicious activity</h3>
              {flags.length === 0 ? (
                <p className="text-sm text-charcoal/70">No flags</p>
              ) : (
                <ul className="list-disc space-y-1 pl-5 text-sm text-charcoal">
                  {flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {tab === 'Analytics' && (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  { label: 'This week', totals: weekTotals },
                  { label: 'This month', totals: monthTotals },
                ] as const
              ).map((block) => (
                <div key={block.label} className="rounded-lg bg-white p-4 ring-1 ring-forest-100">
                  <h3 className="mb-2 text-sm font-semibold text-charcoal">{block.label}</h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm text-charcoal">
                    <dt>Donated (kg)</dt>
                    <dd>{block.totals.donatedKg}</dd>
                    <dt>Collected (kg)</dt>
                    <dd>{block.totals.collectedKg}</dd>
                    <dt>Distributed (kg)</dt>
                    <dd>{block.totals.distributedKg}</dd>
                    <dt>Meals saved</dt>
                    <dd>{block.totals.mealsSaved}</dd>
                  </dl>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg bg-white p-4 ring-1 ring-forest-100">
              <h3 className="mb-2 text-sm font-semibold text-charcoal">Donations by status</h3>
              <BarChart width={560} height={280} data={statusCounts}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="status" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#16a34a" name="Donations" />
              </BarChart>
            </div>
          </section>
        )}

        {tab === 'Sponsors' && (
          <section className="space-y-6">
            <div className="rounded-lg bg-white p-4 ring-1 ring-forest-100">
              <h3 className="mb-2 text-sm font-semibold text-charcoal">Sponsor programmes</h3>
              <ul className="space-y-1 text-sm text-charcoal">
                {state.sponsorPrograms.map((p) => (
                  <li key={p.sponsorId}>
                    {p.organisationName}: {p.programmeName} (allocation ₹{p.fundingAllocationInr})
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-charcoal/70">Funding entries: {state.funding.length}</p>
            </div>
            <form
              onSubmit={onAddFunding}
              className="grid gap-4 rounded-lg bg-white p-4 ring-1 ring-forest-100 sm:grid-cols-2"
            >
              <label className="flex flex-col gap-1 text-sm text-charcoal">
                Sponsor
                <select
                  value={fundingSponsorId}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                    setFundingSponsorId(e.target.value)
                  }
                  className="rounded-md border border-forest-200 bg-white px-3 py-2"
                >
                  <option value="">Choose…</option>
                  {state.sponsorPrograms.map((p) => (
                    <option key={p.sponsorId} value={p.sponsorId}>
                      {p.organisationName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-charcoal">
                Amount (₹)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={fundingAmount}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFundingAmount(e.target.value)}
                  className="rounded-md border border-forest-200 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-charcoal sm:col-span-2">
                Note
                <input
                  type="text"
                  value={fundingNote}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setFundingNote(e.target.value)}
                  className="rounded-md border border-forest-200 px-3 py-2"
                />
              </label>
              {fundingError !== null && (
                <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                  {fundingError}
                </p>
              )}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Add funding entry
                </button>
              </div>
            </form>
          </section>
        )}

        {tab === 'Reports' && (
          <section className="rounded-lg bg-white p-4 ring-1 ring-forest-100">
            <p className="mb-3 text-sm text-charcoal">
              Exports every donation with its collected and distributed totals.
            </p>
            <button
              type="button"
              onClick={downloadCsv}
              className="rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white"
            >
              Download platform CSV
            </button>
          </section>
        )}

        {tab === 'Leaderboards' && (
          <section className="space-y-6">
            <label className="flex items-center gap-2 text-sm text-charcoal">
              <input
                type="checkbox"
                checked={excludePublic}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setExcludePublic(e.target.checked)}
                className="h-4 w-4"
              />
              Exclude from public board (Demo only, not saved)
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  {
                    title: 'Restaurants, caterers and hotels',
                    rows: boards.restaurants.slice(0, 5).map((r) => ({
                      key: r.id,
                      name: r.displayName,
                      score: `${r.collectedKg} kg collected`,
                    })),
                  },
                  {
                    title: 'Event organisers',
                    rows: boards.organisers.slice(0, 5).map((r) => ({
                      key: r.id,
                      name: r.displayName,
                      score: `${r.collectedKg} kg collected`,
                    })),
                  },
                  {
                    title: 'Weddings and events',
                    rows: boards.events.slice(0, 5).map((r) => ({
                      key: r.id,
                      name: r.displayName,
                      score: `${r.deliveredKg} kg delivered`,
                    })),
                  },
                  {
                    title: 'NGOs and volunteers',
                    rows: boards.receivers.slice(0, 5).map((r) => ({
                      key: r.id,
                      name: r.displayName,
                      score: `${r.distributedKg} kg distributed`,
                    })),
                  },
                ] as const
              ).map((board) => (
                <div key={board.title} className="rounded-lg bg-white p-4 ring-1 ring-forest-100">
                  <h3 className="mb-2 text-sm font-semibold text-charcoal">{board.title}</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-sm text-charcoal">
                    {board.rows.map((row) => (
                      <li key={row.key}>
                        {excludePublic ? 'Hidden from public board (demo)' : `${row.name} — ${row.score}`}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
