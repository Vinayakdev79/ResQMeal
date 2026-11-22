import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card } from './Card';
import { cn } from './cn';

const COUNT_UP_MS = 800;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

/** Animates an integer from 0 to `target` with requestAnimationFrame. Returns `target` immediately when reduced motion is preferred or target is undefined. */
function useCountUp(target: number | undefined): number {
  const [display, setDisplay] = useState<number>(() =>
    target === undefined || prefersReducedMotion() ? (target ?? 0) : 0,
  );

  useEffect(() => {
    if (target === undefined) return;
    if (prefersReducedMotion()) {
      setDisplay(target);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    setDisplay(0);
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min((now - start) / COUNT_UP_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return display;
}

export interface StatCardProps {
  /** Metric name, e.g. 'Meals rescued'. */
  label: string;
  /** Metric value; rendered with tabular numerals. */
  value: string | number;
  /** Optional lucide-react icon in the top-right corner. */
  icon?: LucideIcon;
  /** Optional small supporting line under the value. */
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, hint, className }: StatCardProps) {
  const isCount = typeof value === 'number' && Number.isInteger(value);
  const animated = useCountUp(isCount ? value : undefined);
  const shown = isCount ? animated : value;
  return (
    <Card className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight tabular-nums text-charcoal">{shown}</p>
        {hint !== undefined && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </div>
      {Icon !== undefined && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </Card>
  );
}

