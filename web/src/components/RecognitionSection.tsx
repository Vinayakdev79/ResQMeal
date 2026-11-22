import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Trophy } from 'lucide-react';
import { useAppState } from '../lib/AppStateContext';
import { buildLeaderboards, monthRange } from '../lib/leaderboard';
import { SectionHeading } from './SectionHeading';
import { EmptyState, Skeleton } from './ui';

/** Number of rows shown per board on the homepage. */
const TOP_N = 5;

/** Route of the existing Impact page (see App.tsx). */
const IMPACT_ROUTE = '/impact';

/** Privacy: only the public display name from buildLeaderboards is used. No ids, emails or phone numbers. */
interface RecognitionRow {
  rank: number;
  id: string;
  displayName: string;
  count: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface RecognitionBoardProps {
  title: string;
  unitLabel: string;
  rows: RecognitionRow[];
  emptyTitle: string;
  emptyDescription: string;
}

function RecognitionBoard({ title, unitLabel, rows, emptyTitle, emptyDescription }: RecognitionBoardProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <h3 className="font-display text-lg font-semibold tracking-tight text-charcoal">{title}</h3>
      {rows.length === 0 ? (
        <EmptyState className="mt-4" icon={Trophy} title={emptyTitle} description={emptyDescription} />
      ) : (
        <ol className="mt-4 divide-y divide-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center gap-4 py-3">
              <span className="w-6 shrink-0 text-sm font-bold text-sage-600">
                <span className="sr-only">Rank </span>
                {row.rank}
              </span>
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 text-sm font-semibold text-forest-700 ring-1 ring-inset ring-forest-100"
              >
                {initialsOf(row.displayName)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-charcoal">{row.displayName}</span>
              <span className="shrink-0 text-right text-sm text-muted">
                <span className="font-semibold text-forest-700">{row.count}</span> {unitLabel}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * Homepage "Impact & Recognition" section. Top donors and top receivers for the current month,
 * computed from the same local app state and buildLeaderboards logic used by the Impact and Admin pages.
 */
export function RecognitionSection() {
  const { state } = useAppState();

  // The app state is local and synchronous, so this flag only guards the first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const result = useMemo(() => {
    try {
      const boards = buildLeaderboards(state, monthRange(new Date()));
      const donors: RecognitionRow[] = boards.restaurants
        .filter((r) => r.collectedKg > 0)
        .slice(0, TOP_N)
        .map((r) => ({ rank: r.rank, id: r.id, displayName: r.displayName, count: r.successfulDonations }));
      const receivers: RecognitionRow[] = boards.receivers
        .filter((r) => r.distributedKg > 0)
        .slice(0, TOP_N)
        .map((r) => ({ rank: r.rank, id: r.id, displayName: r.displayName, count: r.successfulPickups }));
      return { donors, receivers, error: false };
    } catch {
      return { donors: [] as RecognitionRow[], receivers: [] as RecognitionRow[], error: true };
    }
  }, [state]);

  return (
    <section className="scroll-mt-24 bg-sage-50 py-16" aria-labelledby="recognition-heading">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionHeading
              eyebrow="Impact & Recognition"
              title="Our top donors and receivers"
              description="Names appear only where members have not chosen to stay anonymous. No contact details are shown."
            />
          </div>
          <Link
            to={IMPACT_ROUTE}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-forest-700 px-5 py-3 font-semibold text-forest-700 transition-colors hover:bg-forest-50"
          >
            View Impact & Recognition
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {!mounted ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2" aria-busy="true" aria-label="Loading recognition">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-72 w-full rounded-2xl" />
          </div>
        ) : result.error ? (
          <div
            role="alert"
            className="mt-10 rounded-2xl border border-line bg-surface p-6 text-sm text-muted"
          >
            We could not load recognition data right now. Please try again later.
          </div>
        ) : (
          <div className="stagger mt-10 grid gap-5 md:grid-cols-2">
            <RecognitionBoard
              title="Top donors"
              unitLabel="completed donations"
              rows={result.donors}
              emptyTitle="No top donors yet"
              emptyDescription="Donors appear here once their donations are collected this month."
            />
            <RecognitionBoard
              title="Top receivers"
              unitLabel="completed pickups"
              rows={result.receivers}
              emptyTitle="No top receivers yet"
              emptyDescription="Receivers appear here once their pickups are completed this month."
            />
          </div>
        )}
      </div>
    </section>
  );
}
