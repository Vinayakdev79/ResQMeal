import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface EmptyStateProps {
  /** Optional lucide-react icon shown in a tinted circle. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. a Button or Link). */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center',
        className,
      )}
    >
      {Icon !== undefined && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-100">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold tracking-tight text-charcoal">{title}</h3>
      {description !== undefined && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action !== undefined && <div className="mt-6">{action}</div>}
    </div>
  );
}

