import { LIFECYCLE_LABELS, type LifecycleStatus } from '../lib/lifecycle';

const STATUS_STYLES: Record<LifecycleStatus, string> = {
  posted: 'bg-info-100 text-info-800',
  matched: 'bg-mist text-charcoal ring-1 ring-inset ring-line',
  claimed: 'bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-200',
  pickup_confirmed: 'bg-warning-100 text-warning-800',
  collected: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-100',
  distribution_recorded: 'bg-forest-100 text-forest-800',
  completed: 'bg-success-100 text-success-800',
  expired: 'bg-mist text-muted',
  cancelled: 'bg-danger-100 text-danger-800',
};

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-sans text-xs font-semibold transition-colors ${STATUS_STYLES[status]}`}
    >
      {LIFECYCLE_LABELS[status]}
    </span>
  );
}
