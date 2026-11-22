import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from './cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lifts the card slightly with a stronger shadow on hover. */
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card({ hover = false, className, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-line bg-surface p-5 shadow-sm',
        hover && 'card-hover',
        className,
      )}
      {...rest}
    />
  );
});

