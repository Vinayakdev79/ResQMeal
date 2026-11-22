import { cn } from './cn';

export interface SkeletonProps {
  /** Size and shape, e.g. 'h-4 w-32' or 'h-24 w-full rounded-2xl'. */
  className?: string;
}

/** Shimmering placeholder block. Decorative only; wrap groups in a region with aria-busy when loading. */
export function Skeleton({ className }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('skeleton rounded-md', className)} />;
}

