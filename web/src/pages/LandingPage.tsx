import {
  ArrowRight,
  Building2,
  Briefcase,
  ClipboardList,
  HeartHandshake,
  Leaf,
  ShieldCheck,
  Sprout,
  Truck,
  Users,
  Utensils,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { RecognitionSection } from '../components/RecognitionSection';
import { SectionHeading } from '../components/SectionHeading';
import { StatCard } from '../components/ui';
import { LIFECYCLE_LABELS, LIFECYCLE_ORDER } from '../lib/lifecycle';

const NAV_LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#impact', label: 'Impact' },
  { href: '/impact', label: 'Impact & Recognition' },
  { href: '#donors', label: 'For Donors' },
  { href: '#receivers', label: 'For Receivers' },
  { href: '#sponsors', label: 'For Sponsors' },
];

/** Pilot figures. Numeric values so StatCard can count up; the unit is carried in the label or hint. */
const STATS: { value: number; label: string; hint: string }[] = [
  { value: 1240, label: 'Meals rescued', hint: 'Demo data (synthetic)' },
  { value: 312, label: 'Food diverted from waste (kg)', hint: 'Demo data (synthetic)' },
  { value: 48, label: 'Donor partners', hint: 'Demo data (synthetic)' },
  { value: 19, label: 'Receiving NGOs and kitchens', hint: 'Demo data (synthetic)' },
];

const STEPS = [
  {
    icon: Utensils,
    title: 'Post surplus food',
    text: 'Donors list edible surplus with quantity, pickup point and a collection window.',
  },
  {
    icon: ClipboardList,
    title: 'Claim the listing',
    text: 'A verified NGO or kitchen claims the listing and confirms the pickup.',
  },
  {
    icon: Truck,
    title: 'Collect and distribute',
    text: 'Food is collected and distributed, and each step is recorded until it is complete.',
  },
];

const ROLE_CARDS = [
  {
    id: 'donors',
    icon: Utensils,
    title: 'Donors',
    text: 'Restaurants, caterers and event organisers can post surplus edible food free of charge.',
  },
  {
    id: 'receivers',
    icon: Building2,
    title: 'NGOs',
    text: 'Claim listings and collect your own pickups for your programmes.',
  },
  {
    id: '',
    icon: Users,
    title: 'Volunteers',
    text: 'Independent receivers who collect and distribute food themselves. Volunteers are not delivery partners.',
  },
  {
    id: '',
    icon: Briefcase,
    title: 'Sponsors',
    text: 'Fund programmes. Sponsors pay ResQMeal for programme services and impact reporting.',
  },
];

const SAFETY_POINTS = [
  { icon: Sprout, text: 'ResQMeal does not certify food safety.' },
  { icon: Sprout, text: 'ResQMeal does not guarantee that food is safe to consume.' },
  { icon: HeartHandshake, text: 'Receivers can reject food at pickup.' },
  { icon: HeartHandshake, text: 'Overdue listings expire automatically.' },
];

/** Layered forest and sage panel with an SVG bowl and leaf motif. Decorative only. */
function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
      <div className="absolute inset-0 rounded-[2.5rem] bg-forest-700" />
      <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-sage-300/40 blur-2xl" />
      <div className="absolute -bottom-10 -left-8 h-48 w-48 rounded-full bg-forest-500/60 blur-2xl" />
      <div className="absolute inset-x-10 bottom-10 h-1/3 rounded-3xl bg-sage/25" />
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" fill="none">
        {/* Bowl */}
        <path
          d="M90 210 H310 C310 292 262 330 200 330 C138 330 90 292 90 210 Z"
          fill="#F8F6F0"
          fillOpacity="0.95"
        />
        <path d="M80 210 H320" stroke="#A8B9A3" strokeWidth="10" strokeLinecap="round" />
        {/* Food mound */}
        <path d="M120 212 C140 160 260 160 280 212 Z" fill="#A8B9A3" />
        <circle cx="170" cy="190" r="10" fill="#E4EBE2" />
        <circle cx="222" cy="184" r="8" fill="#E4EBE2" />
        {/* Leaf */}
        <path
          d="M200 150 C160 110 160 60 200 30 C240 60 240 110 200 150 Z"
          fill="#7AAD9C"
        />
        <path d="M200 150 V64" stroke="#173F35" strokeWidth="3" strokeLinecap="round" />
        <path d="M200 110 L180 92 M200 128 L222 108" stroke="#173F35" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between rounded-2xl bg-cream/95 px-4 py-3 text-sm shadow-lg">
        <span className="font-semibold text-forest-700">Pilot in Mathura</span>
        <span className="text-muted">Demo data</span>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream text-charcoal">
      <header className="sticky top-0 z-50 border-b border-line bg-cream/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-forest-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-700 text-cream">
              <Leaf className="h-4 w-4" aria-hidden="true" />
            </span>
            ResQMeal
          </a>
          <ul className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm font-medium text-charcoal/75 transition-colors hover:text-forest-700"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg border border-forest-700 px-3 py-1.5 text-sm font-semibold text-forest-700 transition-colors hover:bg-forest-50"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-lg bg-forest-700 px-3 py-1.5 text-sm font-semibold text-cream transition-colors hover:bg-forest-800"
            >
              Sign up
            </Link>
          </div>
        </nav>
        <ul className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="shrink-0">
              <a href={link.href} className="text-xs font-medium text-charcoal/75 hover:text-forest-700">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
          <div className="reveal">
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-forest-700">
              <span className="h-1.5 w-1.5 rounded-full bg-sage-500" aria-hidden="true" />
              Pilot launch in Mathura, India
            </p>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-charcoal md:text-6xl">
              Rescue surplus food before it goes to waste.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-charcoal/75">
              ResQMeal coordinates food donations between restaurants, caterers, event organisers and NGOs.
              ResQMeal does not certify food safety and does not guarantee that any food is safe to consume.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <a
                href="#donors"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest-700 px-6 py-3.5 font-semibold text-cream shadow-lg shadow-forest-700/20 transition-colors hover:bg-forest-800"
              >
                Post surplus food
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#impact"
                className="inline-flex items-center justify-center rounded-xl border border-forest-700 px-6 py-3.5 font-semibold text-forest-700 transition-colors hover:bg-forest-50"
              >
                Explore impact
              </a>
            </div>
          </div>
          <div className="reveal">
            <HeroVisual />
          </div>
        </section>

        {/* Impact stats with count-up */}
        <section id="impact" className="scroll-mt-24 bg-sage-50 py-16">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading
              eyebrow="Impact"
              title="Pilot figures at a glance"
              description="Placeholder figures for layout only."
            />
            <div className="stagger mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat) => (
                <StatCard key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} />
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-24 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading
              eyebrow="How it works"
              title="From listing to completed distribution"
              description="Every donation moves through the same tracked steps."
            />
            <ol className="stagger mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <li
                    key={step.title}
                    className="relative rounded-2xl border border-line bg-surface p-7 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-display text-4xl font-extrabold text-sage-300" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="mt-6 font-display text-xl font-semibold tracking-tight">
                      <span className="sr-only">Step {index + 1}: </span>
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{step.text}</p>
                  </li>
                );
              })}
            </ol>
            <div className="reveal mt-10 rounded-2xl border border-dashed border-line bg-cream p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tracked stages</p>
              <ol className="mt-3 flex flex-wrap gap-2">
                {LIFECYCLE_ORDER.filter((s) => s !== 'expired' && s !== 'cancelled').map((status, index) => (
                  <li
                    key={status}
                    className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-charcoal ring-1 ring-inset ring-line"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest-700 text-[11px] font-bold text-cream">
                      {index + 1}
                    </span>
                    {LIFECYCLE_LABELS[status]}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <SectionHeading eyebrow="Who takes part" title="A place for every role in the rescue" />
          <div className="stagger mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {ROLE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <article
                  key={card.title}
                  id={card.id !== '' ? card.id : undefined}
                  className="scroll-mt-24 rounded-2xl border border-line bg-surface p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-100 text-forest-700">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-lg font-semibold tracking-tight">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{card.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        {/* Impact & Recognition: top donors and receivers */}
        <RecognitionSection />


        {/* Sponsors */}
        <section id="sponsors" className="scroll-mt-24 mx-auto max-w-6xl px-4 pb-20">
          <SectionHeading
            eyebrow="Sponsors"
            title="Fund programmes and measure their impact"
            description="Sponsors pay ResQMeal for programme services and impact reporting."
          />
        </section>

        {/* Safety */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="reveal grid gap-8 rounded-3xl border border-line bg-surface p-8 md:grid-cols-[1fr_1.4fr] md:p-10">
            <div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-700 text-cream">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="mt-5 font-display text-2xl font-bold tracking-tight">Safety and trust</h2>
              <p className="mt-3 text-xs text-muted">
                ResQMeal makes no promises of tax or legal benefit to any participant.
              </p>
            </div>
            <ul className="stagger grid gap-4 text-sm text-charcoal/80 sm:grid-cols-2">
              {SAFETY_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                  <li key={point.text} className="flex gap-3 rounded-xl bg-cream p-4">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" aria-hidden="true" />
                    <span className="leading-relaxed">{point.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Final CTA band */}
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="reveal relative overflow-hidden rounded-3xl bg-forest-700 px-8 py-14 text-center text-cream md:px-16">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-sage/20 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-forest-500/50 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight md:text-4xl">
                Every meal rescued is a meal that reaches someone.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-cream/75">
                Join the pilot as a donor, an NGO or a sponsor and help keep edible food out of the bin.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  to="/signup"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cream px-6 py-3.5 font-semibold text-forest-700 transition-colors hover:bg-white"
                >
                  Sign up
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center rounded-xl border border-cream/40 px-6 py-3.5 font-semibold text-cream transition-colors hover:bg-cream/10"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <a href="#top" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight text-forest-700">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest-700 text-cream">
                <Leaf className="h-4 w-4" aria-hidden="true" />
              </span>
              ResQMeal
            </a>
            <p className="mt-4 max-w-sm text-sm text-muted">
              Coordinating surplus food donations in Mathura, India.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Explore</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-sm text-charcoal/80 transition-colors hover:text-forest-700">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Account</p>
            <ul className="mt-4 flex flex-col gap-2.5">
              <li>
                <Link to="/login" className="text-sm text-charcoal/80 transition-colors hover:text-forest-700">
                  Log in
                </Link>
              </li>
              <li>
                <Link to="/signup" className="text-sm text-charcoal/80 transition-colors hover:text-forest-700">
                  Sign up
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-center text-xs text-muted">
            All data shown on this site is synthetic demo data. ResQMeal does not certify food safety.
          </p>
        </div>
      </footer>
    </div>
  );
}
