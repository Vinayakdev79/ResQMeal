import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Clock, Package } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import {
  cancelDonation,
  listDonations,
  updateDonation,
  type DonationEditPatch,
  type DonorDonation,
} from '../../lib/donorApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import AppShell from '../../components/AppShell';

type FilterKey = 'all' | 'available' | 'claimed' | 'pickup_scheduled' | 'completed' | 'expired' | 'cancelled';
type DisplayStatus = Exclude<FilterKey, 'all'> | 'removed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'claimed', label: 'Claimed' },
  { key: 'pickup_scheduled', label: 'Pickup Scheduled' },
  { key: 'completed', label: 'Completed' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
];

const UNITS = ['kg', 'plates', 'packets', 'boxes', 'litres', 'pieces'] as const;
const DIETARY = ['Vegetarian', 'Non-vegetarian'] as const;

const STATUS_LABEL: Record<DisplayStatus, string> = {
  available: 'Available',
  claimed: 'Claimed',
  pickup_scheduled: 'Pickup Scheduled',
  completed: 'Completed',
  expired: 'Expired',
  cancelled: 'Cancelled',
  removed: 'Removed by admin',
};

const STATUS_STYLE: Record<DisplayStatus, string> = {
  available: 'bg-success-100 text-success-800',
  claimed: 'bg-warning-100 text-warning-800',
  pickup_scheduled: 'bg-info-100 text-info-800',
  completed: 'bg-forest-100 text-forest-800',
  expired: 'bg-mist text-muted',
  cancelled: 'bg-danger-100 text-danger-800',
  removed: 'bg-danger-100 text-danger-800',
};

const RECEIVER_NOTE_STATUSES: DisplayStatus[] = ['claimed', 'pickup_scheduled', 'completed'];

const BUTTON_PRIMARY_LINK =
  'inline-flex h-10 items-center justify-center rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500';

const INPUT_CLASS =
  'mt-1.5 block w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-charcoal shadow-sm transition-colors focus:border-forest-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500/30';

interface EditForm {
  title: string;
  description: string;
  quantity: string;
  unit: string;
  estimated_people: string;
  special_instructions: string;
  dietary: string;
  pickup_window_start: string;
  pickup_window_end: string;
  expires_at: string;
}

type FormErrors = Partial<Record<keyof EditForm, string>>;

const EMPTY_FORM: EditForm = {
  title: '',
  description: '',
  quantity: '',
  unit: 'kg',
  estimated_people: '',
  special_instructions: '',
  dietary: 'Vegetarian',
  pickup_window_start: '',
  pickup_window_end: '',
  expires_at: '',
};

/** Parse an ISO timestamp into a 'YYYY-MM-DDTHH:mm' string in local time for datetime-local inputs. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value to epoch ms, or null when empty/invalid. */
function parseLocal(value: string): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Please try again.';
}

/** Expired = status 'expired', or 'available' with expires_at in the past. Removed donations get their own label. */
function displayStatus(d: DonorDonation, nowMs: number): DisplayStatus {
  if (d.status === 'removed') return 'removed';
  if (d.status === 'expired') return 'expired';
  if (d.status === 'available') {
    const exp = parseLocal(d.expires_at);
    return exp !== null && exp < nowMs ? 'expired' : 'available';
  }
  return d.status as DisplayStatus;
}

/** Human expiry hint, e.g. "Expires in 3h". Returns the tone used for its colour. */
function expiryIndicator(iso: string, nowMs: number): { text: string; tone: string } {
  const exp = parseLocal(iso);
  if (exp === null) return { text: 'Expiry unknown', tone: 'text-muted' };
  const diffMs = exp - nowMs;
  if (diffMs <= 0) return { text: 'Expired', tone: 'text-danger-700' };
  const hours = diffMs / 3_600_000;
  if (hours < 1) return { text: `Expires in ${Math.max(1, Math.round(diffMs / 60_000))}m`, tone: 'text-danger-700' };
  if (hours < 24) return { text: `Expires in ${Math.round(hours)}h`, tone: 'text-warning-700' };
  return { text: `Expires in ${Math.round(hours / 24)}d`, tone: 'text-muted' };
}

function validate(f: EditForm, nowMs: number): FormErrors {
  const errors: FormErrors = {};
  if (!f.title.trim()) errors.title = 'Title is required.';

  const quantity = Number(f.quantity);
  if (f.quantity.trim() === '' || !Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = 'Quantity must be greater than 0.';
  }

  if (!(UNITS as readonly string[]).includes(f.unit)) errors.unit = 'Choose a unit.';

  const people = Number(f.estimated_people);
  if (f.estimated_people.trim() === '' || !Number.isInteger(people) || people <= 0) {
    errors.estimated_people = 'Enter a whole number greater than 0.';
  }

  if (!(DIETARY as readonly string[]).includes(f.dietary)) errors.dietary = 'Choose a dietary option.';

  const start = parseLocal(f.pickup_window_start);
  const end = parseLocal(f.pickup_window_end);
  const expires = parseLocal(f.expires_at);

  if (start === null) errors.pickup_window_start = 'Pickup start is required.';
  if (end === null) {
    errors.pickup_window_end = 'Pickup end is required.';
  } else if (start !== null && end <= start) {
    errors.pickup_window_end = 'Pickup end must be after pickup start.';
  }

  if (expires === null) {
    errors.expires_at = 'Expiry is required.';
  } else if (expires <= nowMs) {
    errors.expires_at = 'Expiry must be in the future.';
  }

  return errors;
}

function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-muted">
      {label}
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-danger-700">
          {error}
        </span>
      )}
    </label>
  );
}

function DonationCardSkeleton() {
  return (
    <div role="status" aria-label="Loading donations" aria-busy="true" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-64 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export default function DonorDonationsPage() {
  const { user } = useAuth();
  const userId = user?.id;

  const [donations, setDonations] = useState<DonorDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [filter, setFilter] = useState<FilterKey>('all');
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    listDonations(userId)
      .then((rows) => {
        if (!cancelled) setDonations(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  /** Re-fetch after a mutation without blanking the grid. */
  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      setDonations(await listDonations(userId));
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }, [userId]);

  // Computed per render so the expiry rule uses the current time.
  const nowMs = Date.now();
  const statusById = new Map<string, DisplayStatus>();
  for (const d of donations) statusById.set(d.id, displayStatus(d, nowMs));

  const counts: Record<FilterKey, number> = {
    all: donations.length,
    available: 0,
    claimed: 0,
    pickup_scheduled: 0,
    completed: 0,
    expired: 0,
    cancelled: 0,
  };
  for (const status of statusById.values()) {
    if (status !== 'removed') counts[status] += 1;
  }

  const visible = donations.filter((d) => filter === 'all' || statusById.get(d.id) === filter);

  function startEdit(d: DonorDonation) {
    setEditingId(d.id);
    setForm({
      title: d.title ?? '',
      description: d.description ?? '',
      quantity: d.quantity == null ? '' : String(d.quantity),
      unit: d.unit ?? 'kg',
      estimated_people: d.estimated_people == null ? '' : String(d.estimated_people),
      special_instructions: d.special_instructions ?? '',
      dietary: d.is_vegetarian ? 'Vegetarian' : 'Non-vegetarian',
      pickup_window_start: toLocalInput(d.pickup_window_start),
      pickup_window_end: toLocalInput(d.pickup_window_end),
      expires_at: toLocalInput(d.expires_at),
    });
    setFormErrors({});
    setFormError(null);
    setActionError(null);
    setSuccess(null);
  }

  function closeEdit() {
    setEditingId(null);
    setFormErrors({});
    setFormError(null);
  }

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>, d: DonorDonation) {
    e.preventDefault();
    setFormError(null);
    const errors = validate(form, Date.now());
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const patch: DonationEditPatch = {
      title: form.title.trim(),
      description: form.description.trim(),
      quantity: Number(form.quantity),
      unit: form.unit as DonationEditPatch['unit'],
      estimated_people: Number(form.estimated_people),
      special_instructions: form.special_instructions.trim() || null,
      is_vegetarian: form.dietary === 'Vegetarian',
      pickup_window_start: new Date(form.pickup_window_start).toISOString(),
      pickup_window_end: new Date(form.pickup_window_end).toISOString(),
      expires_at: new Date(form.expires_at).toISOString(),
    };

    setSaving(true);
    try {
      await updateDonation(d.id, patch);
      setEditingId(null);
      setSuccess('Donation updated successfully.');
      await refresh();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(d: DonorDonation) {
    if (!window.confirm(`Cancel "${d.title}"? This cannot be undone.`)) return;
    setActionError(null);
    setSuccess(null);
    setBusyId(d.id);
    try {
      await cancelDonation(d.id);
      if (editingId === d.id) closeEdit();
      setSuccess('Donation cancelled.');
      await refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  function renderActions(d: DonorDonation, status: DisplayStatus) {
    if (status === 'available') {
      return (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => startEdit(d)}
            disabled={busyId === d.id || saving}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => handleCancel(d)}
            disabled={busyId === d.id || saving}
          >
            {busyId === d.id ? 'Cancelling…' : 'Cancel'}
          </Button>
        </div>
      );
    }
    if (RECEIVER_NOTE_STATUSES.includes(status)) {
      return <p className="text-xs text-muted">Requests and receiver details are on the Requests page.</p>;
    }
    return <span className="text-xs text-muted">—</span>;
  }

  function renderEditPanel(d: DonorDonation) {
    if (editingId !== d.id) return null;
    const err = formErrors;
    return (
      <form
        onSubmit={(e) => saveEdit(e, d)}
        noValidate
        className="reveal grid gap-4 rounded-2xl border border-forest-200 bg-forest-50/50 p-5 sm:grid-cols-2"
        aria-label={`Edit donation ${d.title}`}
      >
        <div className="flex items-center justify-between sm:col-span-2">
          <h3 className="font-display text-base font-semibold text-charcoal">Edit donation</h3>
          <button
            type="button"
            onClick={closeEdit}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-charcoal focus-visible:outline-2 focus-visible:outline-forest-500"
          >
            Close
          </button>
        </div>

        <Field label="Title" error={err.title}>
          <input className={INPUT_CLASS} value={form.title} onChange={(e) => setField('title', e.target.value)} />
        </Field>

        <Field label="Dietary" error={err.dietary}>
          <select className={INPUT_CLASS} value={form.dietary} onChange={(e) => setField('dietary', e.target.value)}>
            {DIETARY.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Description">
          <textarea
            rows={3}
            className={INPUT_CLASS}
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </Field>

        <Field label="Special instructions">
          <textarea
            rows={3}
            className={INPUT_CLASS}
            value={form.special_instructions}
            onChange={(e) => setField('special_instructions', e.target.value)}
          />
        </Field>

        <Field label="Quantity" error={err.quantity}>
          <input
            type="number"
            min="0"
            step="any"
            className={INPUT_CLASS}
            value={form.quantity}
            onChange={(e) => setField('quantity', e.target.value)}
          />
        </Field>

        <Field label="Unit" error={err.unit}>
          <select className={INPUT_CLASS} value={form.unit} onChange={(e) => setField('unit', e.target.value)}>
            {UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Estimated people" error={err.estimated_people}>
          <input
            type="number"
            min="1"
            step="1"
            className={INPUT_CLASS}
            value={form.estimated_people}
            onChange={(e) => setField('estimated_people', e.target.value)}
          />
        </Field>

        <div className="hidden sm:block" aria-hidden="true" />

        <Field label="Pickup window start" error={err.pickup_window_start}>
          <input
            type="datetime-local"
            className={INPUT_CLASS}
            value={form.pickup_window_start}
            onChange={(e) => setField('pickup_window_start', e.target.value)}
          />
        </Field>

        <Field label="Pickup window end" error={err.pickup_window_end}>
          <input
            type="datetime-local"
            className={INPUT_CLASS}
            value={form.pickup_window_end}
            onChange={(e) => setField('pickup_window_end', e.target.value)}
          />
        </Field>

        <Field label="Expires at" error={err.expires_at}>
          <input
            type="datetime-local"
            className={INPUT_CLASS}
            value={form.expires_at}
            onChange={(e) => setField('expires_at', e.target.value)}
          />
        </Field>

        {formError && (
          <p role="alert" className="rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-sm text-danger-700 sm:col-span-2">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 sm:col-span-2">
          <Button variant="secondary" onClick={closeEdit}>
            Discard
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    );
  }

  function renderEmpty() {
    if (donations.length === 0) {
      return (
        <EmptyState
          icon={Package}
          title="No donations posted yet"
          description="Share surplus food with receivers nearby. Your listings will appear here."
          action={
            <Link to="/donor/post" className={BUTTON_PRIMARY_LINK}>
              Post your first donation
            </Link>
          }
        />
      );
    }
    return <EmptyState icon={Package} title="No donations match this filter" description="Try another status above." />;
  }

  return (
    <AppShell title="My donations">
    <section className="space-y-6">
      <header className="reveal flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">My donations</h1>
          <p className="mt-1 text-sm text-muted">Track, edit and cancel the food you have posted.</p>
        </div>
        <Link to="/donor/post" className={BUTTON_PRIMARY_LINK}>
          Post food
        </Link>
      </header>

      <div role="tablist" aria-label="Filter donations" className="reveal inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-mist p-1">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-forest-500 ${
                active ? 'bg-surface text-forest-700 shadow-sm' : 'text-muted hover:text-charcoal'
              }`}
            >
              {f.label} <span className="tabular-nums opacity-75">({counts[f.key]})</span>
            </button>
          );
        })}
      </div>

      {success && (
        <p role="status" className="rounded-xl border border-success-100 bg-success-50 px-4 py-2 text-sm text-success-800">
          {success}
        </p>
      )}
      {actionError && (
        <p role="alert" className="rounded-xl border border-danger-100 bg-danger-50 px-4 py-2 text-sm text-danger-700">
          {actionError}
        </p>
      )}

      {loading ? (
        <DonationCardSkeleton />
      ) : loadError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-danger-100 bg-danger-50 p-8 text-center">
          <p className="text-sm text-danger-700">Could not load donations: {loadError}</p>
          <Button variant="secondary" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        renderEmpty()
      ) : (
        <ul className="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => {
            const status = statusById.get(d.id) ?? 'available';
            const expiry = expiryIndicator(d.expires_at, nowMs);
            return (
              <li key={d.id} className="contents">
                <Card hover className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-base font-semibold text-charcoal">{d.title}</h2>
                      <p className="text-xs text-muted">{d.category ?? 'Uncategorised'}</p>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-cream p-3">
                    <div>
                      <p className="text-xs text-muted">Quantity</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-charcoal">
                        {d.quantity} {d.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Est. people</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-charcoal">{d.estimated_people ?? '—'}</p>
                    </div>
                  </div>

                  <p className={`inline-flex items-center gap-1.5 text-xs font-semibold ${expiry.tone}`} title={formatDate(d.expires_at)}>
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {expiry.text}
                  </p>

                  <dl className="grid gap-1 text-xs text-muted">
                    <div>
                      <dt className="inline font-medium">Pickup: </dt>
                      <dd className="inline">
                        {formatDate(d.pickup_window_start)} to {formatDate(d.pickup_window_end)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto border-t border-line pt-4">{renderActions(d, status)}</div>
                </Card>
                {editingId === d.id && <div className="sm:col-span-2 xl:col-span-3">{renderEditPanel(d)}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
    </AppShell>
  );
}
