import type { ReactNode } from 'react';
import { Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';

const DEFAULT_TAGLINE = 'Surplus food, rescued and returned to the tables that need it most.';

/** Decorative leaf outline used as a quiet background motif on the forest panel. */
function LeafMotif({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true" className={className}>
      <path
        d="M100 8C160 40 186 98 170 150C158 186 120 196 100 192C78 196 40 184 30 148C14 96 40 40 100 8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M100 30V180" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M100 80L140 56M100 80L60 56M100 120L150 96M100 120L50 96M100 160L132 140M100 160L68 140"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface AuthLayoutProps {
  children: ReactNode;
  /** Wider card for longer forms such as signup. */
  wide?: boolean;
  /** Editorial line shown on the forest panel (desktop only). */
  tagline?: string;
}

/**
 * Split auth layout: a forest brand panel on the left (collapses to a compact header on mobile)
 * and the form card on cream on the right.
 */
export function AuthLayout({ children, wide = false, tagline = DEFAULT_TAGLINE }: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-cream font-sans text-charcoal lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative overflow-hidden bg-forest-700 text-cream lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-12">
        <LeafMotif className="pointer-events-none absolute -bottom-24 -right-24 hidden h-96 w-96 text-forest-500/30 lg:block" />
        <div className="relative flex items-center px-5 py-4 lg:px-0 lg:py-0">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg font-display text-xl font-semibold tracking-tight text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream/60"
          >
            <Leaf className="h-5 w-5" aria-hidden="true" />
            ResQMeal
          </Link>
        </div>
        <div className="relative hidden lg:block">
          <p className="max-w-md font-display text-4xl font-semibold leading-tight tracking-tight">{tagline}</p>
          <p className="mt-4 max-w-sm text-sm text-cream/70">Every plate saved is a meal shared.</p>
        </div>
      </aside>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:px-12 lg:py-16">
        <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
          <section className="reveal rounded-2xl bg-surface p-6 shadow-md ring-1 ring-line md:p-8">{children}</section>
        </div>
      </div>
    </main>
  );
}

export default AuthLayout;
