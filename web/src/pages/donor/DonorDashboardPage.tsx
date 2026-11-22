import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/AppShell';
import { RecognitionSection } from '../../components/RecognitionSection';
import { Skeleton } from '../../components/ui/Skeleton';
import { useAuth } from '../../auth/useAuth';
import { getDonorStats, listDonations } from '../../lib/donorApi';
import type { DonorDonation, DonorStats } from '../../lib/donorApi';

// Same tokens and card treatment as the receiver dashboard.
const BTN =
  'rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-50';
const BTN_GHOST =
  'rounded-lg border border-forest-600 px-4 py-2 text-sm font-semibold text-forest-700 hover:bg-forest-50';
const CARD = 'rounded-2xl border border-forest-100 bg-white p-5 shadow-sm';
const PILL = 'rounded-full bg-forest-100 px-3 py-1 text-xs font-semibold text-forest-800';

const STATUS_LABELS: Record<string, string> = {
  available: 'available',
  claimed: 'claimed',
  pickup_scheduled: 'pickup scheduled',
  completed: 'completed',
  expired: 'expired',
  cancelled: 'cancelled',
  removed: 'removed',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message !== '') return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return fallback;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-4 text-xl font-bold text-charcoal">{title}</h2>
      {children}
    </section>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={PILL}>{statusLabel(status)}</span>;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD}>
      <p className="text-sm text-charcoal/70">{label}</p>
      <p className="text-2xl font-bold text-charcoal">{value}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading dashboard" aria-busy="true">
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
      <div className="mt-8">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
      <div className="mt-8">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export default function DonorDashboardPage() {
  const { user, profile } = useAuth();
  const userId = user?.id;

  const [stats, setStats] = useState<DonorStats | null>(null);
  const [recent, setRecent] = useState<DonorDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      setRecent([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getDonorStats(userId), listDonations(userId)])
      .then(([donorStats, donations]) => {
        if (cancelled) return;
        const newestFirst = [...donations].sort((a, b) => b.created_at.localeCompare(a.created_at));
        setStats(donorStats);
        setRecent(newestFirst.slice(0, 5));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err, 'We could not load your dashboard. Please try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  const displayName = profile?.organization_name || profile?.full_name || '';
  const greeting = displayName !== '' ? `Welcome back, ${displayName}` : 'Welcome back';
  const pendingRequests = recent.filter((d) => d.status === 'claimed' || d.status === 'pickup_scheduled');

  return (
    <AppShell title="Donor dashboard">
      <section className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-charcoal">{greeting}</h2>
          <p className="mt-1 text-sm text-charcoal/70">An overview of your food donations and pickups.</p>
        </div>
        <Link to="/donor/post" className={BTN}>
          Post food
        </Link>
      </section>

      {error !== null && (
        <div role="alert" className="mt-8 rounded-2xl border border-forest-100 bg-white p-5 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" className={`mt-3 ${BTN_GHOST}`} onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </div>
      )}

      {error === null && loading && <DashboardSkeleton />}

      {error === null && !loading && stats !== null && (
        <>
          <section aria-label="Summary" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Total donations" value={stats.total} />
            <SummaryCard label="Active donations" value={stats.available + stats.claimed} />
            <SummaryCard label="Completed donations" value={stats.completed} />
            <SummaryCard label="Meals contributed" value={stats.estimatedMeals.toLocaleString()} />
          </section>

          <Section title="Recent donation activity">
            <article className={CARD}>
              {recent.length === 0 ? (
                <p className="text-sm text-charcoal/70">No donations yet. Post your first donation to help receivers nearby.</p>
              ) : (
                <ol className="relative ml-2 space-y-6 border-l-2 border-forest-100 pl-6">
                  {recent.map((donation) => (
                    <li key={donation.id} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[31px] top-1.5 h-3 w-3 rounded-full bg-forest-500 ring-4 ring-white"
                      />
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-semibold text-charcoal">{donation.title}</h3>
                          <p className="mt-1 text-sm text-charcoal/70">
                            {donation.quantity} {donation.unit} · Estimated people: {donation.estimated_people}
                          </p>
                          <p className="text-xs text-charcoal/60">Expires {formatDateTime(donation.expires_at)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={donation.status} />
                          <Link to="/donor/donations" className="text-sm font-semibold text-forest-700 hover:underline">
                            View
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <Link to="/donor/donations" className="mt-6 inline-block text-sm font-semibold text-forest-700 hover:underline">
                View all donations
              </Link>
            </article>
          </Section>

          <Section title="Pending receiver requests">
            <article className={CARD}>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-charcoal/70">No receiver requests waiting on you.</p>
              ) : (
                <ul className="divide-y divide-forest-100">
                  {pendingRequests.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-charcoal">{d.title}</p>
                        <p className="text-xs text-charcoal/70">
                          {d.quantity} {d.unit}
                        </p>
                      </div>
                      <StatusBadge status={d.status} />
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/donor/requests" className={`mt-4 inline-block ${BTN_GHOST}`}>
                Open requests
              </Link>
            </article>
          </Section>

          <div className="mt-8">
            <RecognitionSection />
          </div>

          <Section title="Personal impact report">
            <article className={CARD}>
              <p className="text-sm text-charcoal/70">
                Open your reports for donation history and impact figures.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link to="/reports" className={BTN}>
                  Open impact report
                </Link>
                <Link to="/impact" className={BTN_GHOST}>
                  View community impact
                </Link>
              </div>
            </article>
          </Section>
        </>
      )}
    </AppShell>
  );
}
