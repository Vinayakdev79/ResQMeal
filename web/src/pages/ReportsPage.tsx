import { useMemo, useState, type ReactNode } from 'react';
import { Download, FileText, Filter, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AppShell from '../components/AppShell';
import { Podium, type PodiumEntry } from '../components/Podium';
import { StatCard } from '../components/ui';
import { useAppState } from '../lib/AppStateContext';
import { LIFECYCLE_LABELS } from '../lib/lifecycle';
import type { LifecycleStatus } from '../lib/lifecycle';
import {
  collectedKg,
  distributedKg,
  donatedKg,
  estimatedEmissionsAvoidedKg,
  MEALS_DIVISOR_KG,
  mealsSaved,
} from '../lib/impact';
import { buildLeaderboards, customRange, donationDonorLabel, monthRange } from '../lib/leaderboard';
import type { DateRange } from '../lib/leaderboard';
import type { Claim, Donation, DonorType, User } from '../lib/types';

type DonorTypeFilter = 'all' | DonorType;

const DONOR_TYPE_OPTIONS: readonly { value: DonorTypeFilter; label: string }[] = [
  { value: 'all', label: 'All donor types' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'caterer', label: 'Caterer' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'event_organiser', label: 'Event organiser' },
  { value: 'wedding_host', label: 'Wedding host' },
];

const COLUMN_KEYS: readonly string[] = [
  'donation_id',
  'created_at',
  'donor',
  'donor_type',
  'event',
  'food',
  'category',
  'quantity_kg',
  'collected_kg',
  'distributed_kg',
  'status',
];

interface ReportRow {
  donationId: string;
  createdAt: string;
  donor: string;
  donorType: string;
  event: string;
  food: string;
  category: string;
  quantityKg: number;
  collectedKg: number;
  distributedKg: number;
  status: LifecycleStatus;
}

interface SummaryItem {
  label: string;
  value: string;
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

function rowValues(r: ReportRow): (string | number)[] {
  return [
    r.donationId,
    r.createdAt,
    r.donor,
    r.donorType,
    r.event,
    r.food,
    r.category,
    r.quantityKg,
    r.collectedKg,
    r.distributedKg,
    r.status,
  ];
}

/** RFC 4180-style quoting for a single CSV cell. */
function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildCsv(rows: ReportRow[], summary: SummaryItem[]): string {
  const lines: string[] = [];
  lines.push(COLUMN_KEYS.map(csvCell).join(','));
  for (const r of rows) {
    lines.push(rowValues(r).map(csvCell).join(','));
  }
  lines.push('');
  lines.push('summary_metric,summary_value');
  for (const s of summary) {
    lines.push([csvCell(s.label), csvCell(s.value)].join(','));
  }
  return lines.join('\r\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Printable HTML for the PDF export. Opened in a new window and printed with window.print(). */
function buildPrintHtml(title: string, rangeLabel: string, summary: SummaryItem[], rows: ReportRow[]): string {
  const summaryHtml = summary
    .map((s) => `<tr><th>${escapeHtml(s.label)}</th><td>${escapeHtml(s.value)}</td></tr>`)
    .join('');
  const headHtml = COLUMN_KEYS.map((k) => `<th>${escapeHtml(k)}</th>`).join('');
  const bodyHtml = rows
    .map(
      (r) =>
        `<tr>${rowValues(r)
          .map((v) => `<td>${escapeHtml(String(v))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body { font-family: Arial, sans-serif; color: #252B28; margin: 24px; }
h1 { color: #173F35; font-size: 20px; }
h2 { font-size: 15px; margin-top: 20px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
th, td { border: 1px solid #ccc; padding: 4px 6px; font-size: 11px; text-align: left; vertical-align: top; }
thead th { background: #EEF4F2; }
p.note { font-size: 11px; color: #555; }
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p class="note">Synthetic demo data for ${escapeHtml(rangeLabel)}. Not real donation records.</p>
<h2>Summary</h2>
<table><tbody>${summaryHtml}</tbody></table>
<h2>Donations</h2>
<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body>
</html>`;
}

/** Triggers a file download through a Blob URL and an anchor element. */
function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function kgText(value: number): string {
  return `${value.toFixed(1)} kg`;
}

function SectionCard({
  title,
  icon: Icon,
  children,
  ariaLabel,
  className = '',
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={`rounded-2xl border border-line bg-surface p-5 shadow-sm md:p-7 ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon !== undefined && (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function ReportsPage() {
  const { state } = useAppState();

  const [startDate, setStartDate] = useState<string>(() => toInputDate(monthRange(new Date()).start));
  const [endDate, setEndDate] = useState<string>(() => toInputDate(new Date()));
  const [donorType, setDonorType] = useState<DonorTypeFilter>('all');
  const [donorId, setDonorId] = useState<string>('');
  const [ngoId, setNgoId] = useState<string>('');
  const [volunteerId, setVolunteerId] = useState<string>('');
  const [eventId, setEventId] = useState<string>('');
  const [exportNote, setExportNote] = useState<string | null>(null);

  const rangeValid = startDate !== '' && endDate !== '' && endDate >= startDate;

  const range = useMemo<DateRange>(
    () =>
      rangeValid
        ? customRange(`${startDate}T00:00:00`, `${endDate}T23:59:59.999`)
        : monthRange(new Date()),
    [rangeValid, startDate, endDate],
  );

  const userById = useMemo(() => new Map(state.users.map((u) => [u.id, u] as const)), [state.users]);
  const eventById = useMemo(() => new Map(state.events.map((e) => [e.id, e] as const)), [state.events]);

  const scopedDonations = useMemo(
    () =>
      state.donations.filter((d) => {
        if (!inRange(d.createdAt, range)) return false;
        if (donorId !== '' && d.donorId !== donorId) return false;
        if (eventId !== '' && d.eventId !== eventId) return false;
        if (donorType !== 'all') {
          const donor = userById.get(d.donorId);
          if (donor?.donorType !== donorType) return false;
        }
        return true;
      }),
    [state.donations, range, donorId, eventId, donorType, userById],
  );

  // Claims on the scoped donations, limited to the selected NGO and/or volunteer.
  const claimsInScope = useMemo<Claim[]>(() => {
    const ids = new Set(scopedDonations.map((d) => d.id));
    return state.claims.filter(
      (c) =>
        ids.has(c.donationId) &&
        (ngoId === '' || c.receiverId === ngoId) &&
        (volunteerId === '' || c.receiverId === volunteerId),
    );
  }, [state.claims, scopedDonations, ngoId, volunteerId]);

  const receiverFilterActive = ngoId !== '' || volunteerId !== '';

  const donations = useMemo<Donation[]>(
    () =>
      receiverFilterActive
        ? scopedDonations.filter((d) => claimsInScope.some((c) => c.donationId === d.id))
        : scopedDonations,
    [receiverFilterActive, scopedDonations, claimsInScope],
  );

  const rows = useMemo<ReportRow[]>(
    () =>
      donations.map((d) => {
        const donor = userById.get(d.donorId);
        const event = d.eventId === undefined ? undefined : eventById.get(d.eventId);
        const mine = claimsInScope.filter((c) => c.donationId === d.id);
        return {
          donationId: d.id,
          createdAt: d.createdAt,
          donor: donationDonorLabel(d, donor),
          donorType: donor?.donorType ?? '',
          event: event?.name ?? '',
          food: d.foodName,
          category: d.category,
          quantityKg: d.quantityKg,
          collectedKg: collectedKg(mine),
          distributedKg: distributedKg(mine),
          status: d.status,
        };
      }),
    [donations, claimsInScope, userById, eventById],
  );

  const donated = donatedKg(donations);
  const collected = collectedKg(claimsInScope);
  const distributed = distributedKg(claimsInScope);
  const meals = mealsSaved(distributed);
  const emissions = estimatedEmissionsAvoidedKg(distributed);
  const activeDonors = new Set(donations.map((d) => d.donorId)).size;
  const activeReceivers = new Set(claimsInScope.map((c) => c.receiverId)).size;
  const completedCount = donations.filter((d) => d.status === 'completed').length;
  const expiredCount = donations.filter((d) => d.status === 'expired').length;

  const summary: SummaryItem[] = [
    { label: 'Date range', value: rangeValid ? `${startDate} to ${endDate}` : 'Invalid range' },
    { label: 'Donated (kg)', value: donated.toFixed(1) },
    { label: 'Collected (kg)', value: collected.toFixed(1) },
    { label: 'Distributed (kg)', value: distributed.toFixed(1) },
    { label: 'Estimated meals saved', value: String(meals) },
    { label: 'Estimated emissions avoided (kg CO2e, estimate, not a measured reduction)', value: emissions.toFixed(1) },
    { label: 'Active donors', value: String(activeDonors) },
    { label: 'Active receivers', value: String(activeReceivers) },
    { label: 'Successful donations (completed)', value: String(completedCount) },
    { label: 'Expired donations', value: String(expiredCount) },
  ];

  const boards = useMemo(() => buildLeaderboards(state, range), [state, range]);

  const restaurantPodium: PodiumEntry[] = boards.restaurants
    .slice(0, 3)
    .map((r) => ({ id: r.id, rank: r.rank, name: r.displayName, metric: kgText(r.collectedKg) }));
  const organiserPodium: PodiumEntry[] = boards.organisers
    .slice(0, 3)
    .map((r) => ({ id: r.id, rank: r.rank, name: r.displayName, metric: kgText(r.collectedKg) }));
  const eventPodium: PodiumEntry[] = boards.events
    .slice(0, 3)
    .map((r) => ({ id: r.id, rank: r.rank, name: r.displayName, metric: kgText(r.deliveredKg) }));
  const receiverPodium: PodiumEntry[] = boards.receivers
    .slice(0, 3)
    .map((r) => ({ id: r.id, rank: r.rank, name: r.displayName, metric: kgText(r.distributedKg) }));

  const donorOptions: User[] = state.users.filter((u) => u.role === 'donor');
  const ngoOptions: User[] = state.users.filter((u) => u.role === 'receiver');
  // There is no 'volunteer' role any more, so the volunteer filter has no options.
  const volunteerOptions: User[] = [];

  const handleCsv = () => {
    if (!rangeValid) return;
    const csv = buildCsv(rows, summary);
    downloadBlob(`resqmeal-report-${startDate}-${endDate}.csv`, csv, 'text/csv;charset=utf-8');
    setExportNote(null);
  };

  const handlePdf = () => {
    if (!rangeValid) return;
    const html = buildPrintHtml('ResQMeal report (synthetic demo data)', `${startDate} to ${endDate}`, summary, rows);
    const printWindow = window.open('', '_blank');
    if (printWindow === null) {
      setExportNote('Pop-up blocked. Allow pop-ups for this site to open the printable PDF.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setExportNote(null);
  };

  const selectClass =
    'mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-charcoal focus:border-forest-600 focus:outline-none focus:ring-2 focus:ring-forest-200';
  const labelClass = 'flex flex-col text-sm font-medium text-charcoal';

  return (
    <AppShell title="Reports">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <header className="reveal flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-600">Reporting</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-charcoal md:text-4xl">
            Reports & exports
          </h2>
          <p className="max-w-2xl text-sm text-muted">
            Filter donations, review contribution rankings and export the selected range. Synthetic demo data.
          </p>
        </header>

        {/* Filters */}
        <SectionCard title="Filters" icon={Filter} ariaLabel="Report filters">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={labelClass}>
              Start date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={selectClass}
              />
            </label>
            <label className={labelClass}>
              End date
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={selectClass}
              />
            </label>
            <label className={labelClass}>
              Donor type
              <select
                value={donorType}
                onChange={(e) => setDonorType(e.target.value as DonorTypeFilter)}
                className={selectClass}
              >
                {DONOR_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Specific donor
              <select value={donorId} onChange={(e) => setDonorId(e.target.value)} className={selectClass}>
                <option value="">All donors</option>
                {donorOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              NGO
              <select value={ngoId} onChange={(e) => setNgoId(e.target.value)} className={selectClass}>
                <option value="">All NGOs</option>
                {ngoOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Volunteer
              <select value={volunteerId} onChange={(e) => setVolunteerId(e.target.value)} className={selectClass}>
                <option value="">All volunteers</option>
                {volunteerOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Event
              <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={selectClass}>
                <option value="">All events</option>
                {state.events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!rangeValid && (
            <p className="mt-4 text-sm text-danger-700">
              Choose a start and end date (end on or after start) to export.
            </p>
          )}
        </SectionCard>

        {/* Export */}
        <section aria-label="Export" className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleCsv}
            disabled={!rangeValid}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2.5 text-sm font-semibold text-cream shadow-sm transition-colors hover:bg-forest-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Download CSV
          </button>
          <button
            type="button"
            onClick={handlePdf}
            disabled={!rangeValid}
            className="inline-flex items-center gap-2 rounded-xl border border-forest-700 bg-surface px-5 py-2.5 text-sm font-semibold text-forest-700 transition-colors hover:bg-forest-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            Download PDF
          </button>
          {exportNote !== null && <p className="text-sm text-danger-700">{exportNote}</p>}
        </section>

        {/* Summary */}
        <section aria-label="Summary">
          <h2 className="font-display text-xl font-bold tracking-tight">Summary</h2>
          <ul className="stagger mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <li className="h-full">
              <StatCard label="Donated" value={kgText(donated)} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard label="Collected" value={kgText(collected)} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard label="Distributed" value={kgText(distributed)} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard label="Estimated meals saved" value={meals.toLocaleString()} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard
                label="Emissions avoided"
                value={`${emissions.toFixed(1)} kg CO₂e`}
                hint="Estimate, not a measured reduction"
                className="h-full"
              />
            </li>
            <li className="h-full">
              <StatCard label="Active donors / receivers" value={`${activeDonors} / ${activeReceivers}`} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard label="Successful donations (completed)" value={completedCount} className="h-full" />
            </li>
            <li className="h-full">
              <StatCard label="Expired donations" value={expiredCount} className="h-full" />
            </li>
          </ul>
        </section>

        {/* Contribution rankings */}
        <section aria-label="Contribution rankings" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SectionCard title="Restaurants & caterers" icon={Trophy}>
            {boards.restaurants.length === 0 ? (
              <p className="rounded-xl bg-cream p-4 text-sm text-muted">No activity in this range.</p>
            ) : (
              <>
                <Podium entries={restaurantPodium} />
                <ol className="mt-6 divide-y divide-line text-sm">
                  {boards.restaurants.slice(3).map((r) => (
                    <li key={r.id} className="flex justify-between py-2.5">
                      <span className="text-charcoal">
                        <span className="mr-2 font-display font-semibold text-muted">#{r.rank}</span>
                        {r.displayName}
                      </span>
                      <span className="font-semibold text-forest-700">{kgText(r.collectedKg)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </SectionCard>
          <SectionCard title="Event organisers" icon={Trophy}>
            {boards.organisers.length === 0 ? (
              <p className="rounded-xl bg-cream p-4 text-sm text-muted">No activity in this range.</p>
            ) : (
              <>
                <Podium entries={organiserPodium} />
                <ol className="mt-6 divide-y divide-line text-sm">
                  {boards.organisers.slice(3).map((r) => (
                    <li key={r.id} className="flex justify-between py-2.5">
                      <span className="text-charcoal">
                        <span className="mr-2 font-display font-semibold text-muted">#{r.rank}</span>
                        {r.displayName}
                      </span>
                      <span className="font-semibold text-forest-700">{kgText(r.collectedKg)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </SectionCard>
          <SectionCard title="Weddings & events" icon={Trophy}>
            {boards.events.length === 0 ? (
              <p className="rounded-xl bg-cream p-4 text-sm text-muted">No events on record.</p>
            ) : (
              <>
                <Podium entries={eventPodium} />
                <ol className="mt-6 divide-y divide-line text-sm">
                  {boards.events.slice(3).map((r) => (
                    <li key={r.id} className="flex justify-between py-2.5">
                      <span className="text-charcoal">
                        <span className="mr-2 font-display font-semibold text-muted">#{r.rank}</span>
                        {r.displayName}
                      </span>
                      <span className="font-semibold text-forest-700">{kgText(r.deliveredKg)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </SectionCard>
          <SectionCard title="NGOs & volunteers" icon={Trophy}>
            {boards.receivers.length === 0 ? (
              <p className="rounded-xl bg-cream p-4 text-sm text-muted">No activity in this range.</p>
            ) : (
              <>
                <Podium entries={receiverPodium} />
                <ol className="mt-6 divide-y divide-line text-sm">
                  {boards.receivers.slice(3).map((r) => (
                    <li key={r.id} className="flex justify-between py-2.5">
                      <span className="text-charcoal">
                        <span className="mr-2 font-display font-semibold text-muted">#{r.rank}</span>
                        {r.displayName}
                      </span>
                      <span className="font-semibold text-forest-700">{kgText(r.distributedKg)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </SectionCard>
        </section>

        {/* Donations table */}
        <SectionCard title={`Donations (${rows.length})`} ariaLabel="Donations table">
          <p className="-mt-3 text-sm text-muted">Synthetic demo data.</p>
          {rows.length === 0 ? (
            <p className="mt-4 rounded-xl bg-cream p-4 text-sm text-muted">No donations match these filters.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-line">
              <table className="min-w-full divide-y divide-line text-left text-sm">
                <thead className="bg-cream">
                  <tr>
                    {COLUMN_KEYS.map((k) => (
                      <th
                        key={k}
                        scope="col"
                        className="whitespace-nowrap px-3 py-2.5 font-display text-xs font-semibold uppercase tracking-wide text-muted"
                      >
                        {k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {rows.map((r) => (
                    <tr key={r.donationId} className="transition-colors hover:bg-sage-50/60">
                      <td className="whitespace-nowrap px-3 py-2.5">{r.donationId}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2.5">{r.donor}</td>
                      <td className="px-3 py-2.5">{r.donorType}</td>
                      <td className="px-3 py-2.5">{r.event}</td>
                      <td className="px-3 py-2.5">{r.food}</td>
                      <td className="px-3 py-2.5">{r.category}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.quantityKg.toFixed(1)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.collectedKg.toFixed(1)}</td>
                      <td className="px-3 py-2.5 tabular-nums">{r.distributedKg.toFixed(1)}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{LIFECYCLE_LABELS[r.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-5 text-xs text-muted">
            Meals saved = verified distributed kg ÷ {MEALS_DIVISOR_KG} kg. Emissions figures are estimates, not measured
            reductions.
          </p>
        </SectionCard>
      </div>
    </AppShell>
  );
}
