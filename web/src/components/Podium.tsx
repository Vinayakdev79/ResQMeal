import { Crown, Medal } from 'lucide-react';

export interface PodiumEntry {
  id: string;
  rank: number;
  name: string;
  /** Headline contribution, e.g. '120.0 kg verified'. */
  metric: string;
  /** Optional supporting figures shown under the headline. */
  stats?: { label: string; value: string }[];
  /** When provided, the name becomes a button (e.g. to open a contribution history). */
  onSelect?: () => void;
}

/** Initials for an avatar. No photos exist, so names are the only identity cue. */
export function initialsFor(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return letters === '' ? '?' : letters;
}

const AVATAR_CLASS: Record<number, string> = {
  1: 'bg-forest-700 text-cream ring-sage-200',
  2: 'bg-sage-300 text-forest-900 ring-sage-100',
  3: 'bg-sage-100 text-forest-700 ring-sage-50',
};

const BADGE_CLASS: Record<number, string> = {
  1: 'bg-forest-700 text-cream',
  2: 'bg-sage-200 text-forest-900',
  3: 'bg-sage-100 text-forest-700',
};

const RANK_LABEL: Record<number, string> = { 1: 'Gold', 2: 'Silver', 3: 'Bronze' };

/**
 * Podium for the top three of a leaderboard. Entries are displayed 2nd, 1st, 3rd
 * (based on their position in `entries`, which must be ordered by rank).
 */
export function Podium({ entries }: { entries: PodiumEntry[] }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;
  const ordered = [top[1], top[0], top[2]].filter(
    (entry): entry is PodiumEntry => entry !== undefined,
  );

  return (
    <ul aria-label="Top three" className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
      {ordered.map((entry) => {
        const isFirst = entry.rank === 1;
        const Icon = isFirst ? Crown : Medal;
        const label = RANK_LABEL[entry.rank];
        return (
          <li
            key={entry.id}
            className={`flex flex-col items-center rounded-2xl border bg-surface p-5 text-center shadow-sm ${
              isFirst ? 'border-forest-700 md:-mt-4 md:pb-7' : 'border-line'
            }`}
          >
            <span
              aria-hidden="true"
              className={`flex h-16 w-16 items-center justify-center rounded-full font-display text-lg font-bold ring-4 ${AVATAR_CLASS[entry.rank] ?? AVATAR_CLASS[3]}`}
            >
              {initialsFor(entry.name)}
            </span>
            <span
              className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_CLASS[entry.rank] ?? BADGE_CLASS[3]}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {label !== undefined ? `${label} · ` : ''}#{entry.rank}
            </span>
            {entry.onSelect !== undefined ? (
              <button
                type="button"
                onClick={entry.onSelect}
                className="mt-2 font-semibold text-forest-700 underline-offset-2 hover:underline"
              >
                {entry.name}
              </button>
            ) : (
              <span className="mt-2 font-semibold text-charcoal">{entry.name}</span>
            )}
            <p className="mt-1 font-display text-base font-bold tracking-tight text-forest-700">{entry.metric}</p>
            {entry.stats !== undefined && entry.stats.length > 0 && (
              <dl className="mt-3 w-full space-y-1 border-t border-line pt-3 text-xs">
                {entry.stats.map((stat) => (
                  <div key={stat.label} className="flex justify-between gap-2">
                    <dt className="text-muted">{stat.label}</dt>
                    <dd className="font-semibold text-charcoal">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        );
      })}
    </ul>
  );
}
