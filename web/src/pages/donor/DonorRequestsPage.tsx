import { useEffect, useState } from 'react'
import { CalendarClock, Inbox, MapPin, Phone, RefreshCw } from 'lucide-react'
import {
  listDonorRequests,
  decideRequest,
  schedulePickup,
  confirmCompleted,
} from '../../lib/donorApi'
import type { DonorRequestRow, RequestStatus } from '../../lib/donorApi'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { Input } from '../../components/ui/Input'
import { Skeleton } from '../../components/ui/Skeleton'
import AppShell from '../../components/AppShell'

type Tab = 'incoming' | 'history'
type Notice = { type: 'success' | 'error'; text: string } | null

const POLL_INTERVAL_MS = 15000

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  collected: 'Collected',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  failed: 'Failed',
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-warning-100 text-warning-800',
  accepted: 'bg-info-100 text-info-800',
  collected: 'bg-forest-100 text-forest-800',
  completed: 'bg-success-100 text-success-800',
  rejected: 'bg-danger-100 text-danger-800',
  cancelled: 'bg-mist text-muted',
  failed: 'bg-danger-100 text-danger-800',
}

const BUTTON_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-forest-700 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-forest-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest-500 disabled:cursor-not-allowed disabled:opacity-50'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

function formatDate(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString()
}

/** Two-letter avatar text from a receiver's name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

function StatusBadge({ status }: { status: RequestStatus | string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        STATUS_CLASS[status] ?? 'bg-mist text-muted'
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

function RequestSkeleton() {
  return (
    <div role="status" aria-label="Loading requests" aria-busy="true" className="space-y-4">
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-56 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export default function DonorRequestsPage() {
  const { user } = useAuth()
  const userId = user?.id

  const [requests, setRequests] = useState<DonorRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [tab, setTab] = useState<Tab>('incoming')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [scheduleAt, setScheduleAt] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    const load = () => {
      listDonorRequests()
        .then((rows) => {
          if (!cancelled) {
            setRequests(rows)
            setError(null)
          }
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(errMsg(e))
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    setLoading(true)
    setError(null)
    load()
    const timer = window.setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId, reloadKey])

  async function refresh() {
    if (!userId) return
    try {
      setRequests(await listDonorRequests())
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) })
    }
  }

  async function runAction(id: string, action: () => Promise<unknown>, successText: string) {
    setBusyId(id)
    setNotice(null)
    try {
      await action()
      setNotice({ type: 'success', text: successText })
      await refresh()
    } catch (e) {
      setNotice({ type: 'error', text: errMsg(e) })
    } finally {
      setBusyId(null)
    }
  }

  function handleSchedule(r: DonorRequestRow) {
    const value = scheduleAt[r.request_id] ?? ''
    if (!value) {
      setNotice({ type: 'error', text: 'Choose a pickup date and time first.' })
      return
    }
    const when = new Date(value)
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setNotice({ type: 'error', text: 'Pickup time must be in the future.' })
      return
    }
    void runAction(
      r.request_id,
      () => schedulePickup(r.request_id, when.toISOString()),
      'Pickup scheduled.',
    )
  }

  const incoming = requests.filter((r) => r.request_status === 'pending')
  const history = requests.filter((r) => r.request_status !== 'pending')
  const visible = tab === 'incoming' ? incoming : history

  const tabButton = (value: Tab, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={tab === value}
      onClick={() => setTab(value)}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-forest-500 ${
        tab === value ? 'bg-surface text-forest-700 shadow-sm' : 'text-muted hover:text-charcoal'
      }`}
    >
      {label} <span className="ml-1 tabular-nums opacity-80">({count})</span>
    </button>
  )

  const emptyText =
    tab === 'incoming' ? 'No incoming requests right now.' : 'No pickups or history yet.'

  return (
    <AppShell title="Requests">
    <div className="space-y-6">
      <header className="reveal">
        <h1 className="font-display text-2xl font-bold tracking-tight text-charcoal">Requests</h1>
        <p className="mt-1 text-sm text-muted">
          Review receiver requests, schedule pickups and confirm completed collections.
        </p>
      </header>

      <div className="reveal inline-flex max-w-full flex-wrap gap-1 rounded-xl bg-mist p-1">
        {tabButton('incoming', 'Incoming requests', incoming.length)}
        {tabButton('history', 'Pickups & history', history.length)}
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            notice.type === 'success'
              ? 'border-success-100 bg-success-50 text-success-800'
              : 'border-danger-100 bg-danger-50 text-danger-700'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <RequestSkeleton />
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-2 inline-flex items-center gap-1 font-semibold underline focus-visible:outline-2 focus-visible:outline-forest-500"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyText} />
      ) : (
        <ul className="stagger space-y-4">
          {visible.map((r) => {
            const busy = busyId === r.request_id
            const receiverName = r.receiver_organization || r.receiver_name || 'Receiver'
            const phone = r.receiver_phone ?? ''
            const unit = r.donation_unit
            return (
              <li key={r.request_id} className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-100 font-display text-sm font-bold text-forest-800"
                    >
                      {initials(receiverName)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-base font-semibold text-charcoal">{r.donation_title}</h2>
                      <p className="text-sm text-charcoal">{receiverName}</p>
                      <p className="text-xs text-muted">Requested {formatDate(r.requested_at)}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.request_status} />
                </div>

                <div className="grid gap-2 rounded-xl bg-cream p-4 text-sm text-charcoal sm:grid-cols-2">
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    <span>{r.receiver_city || '—'}</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
                    {phone ? (
                      <a href={`tel:${phone}`} className="font-medium text-forest-700 hover:underline">
                        {phone}
                      </a>
                    ) : (
                      <span>—</span>
                    )}
                  </p>
                  <p>
                    Requested quantity: <span className="font-semibold">{r.requested_quantity} {unit}</span>
                  </p>
                  <p>
                    Donation remaining: <span className="font-semibold">{r.donation_remaining} {unit}</span>{' '}
                    of {r.donation_quantity} {unit} · {STATUS_LABEL[r.donation_status] ?? r.donation_status}
                  </p>
                </div>

                {r.request_message && (
                  <blockquote className="rounded-xl border-l-4 border-forest-200 bg-mist px-4 py-2 text-sm italic text-charcoal">
                    “{r.request_message}”
                  </blockquote>
                )}

                {r.request_status === 'pending' && (
                  <div className="flex flex-wrap gap-2 border-t border-line pt-4">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void runAction(r.request_id, () => decideRequest(r.request_id, 'accept'), 'Request accepted.')
                      }
                    >
                      {busy ? 'Working…' : 'Accept'}
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy}
                      onClick={() =>
                        void runAction(r.request_id, () => decideRequest(r.request_id, 'reject'), 'Request rejected.')
                      }
                    >
                      Reject
                    </Button>
                  </div>
                )}

                {r.request_status === 'accepted' && (
                  <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
                    <label className="flex flex-col text-sm font-medium text-muted">
                      <span className="mb-1.5">Pickup date and time</span>
                      <Input
                        type="datetime-local"
                        value={scheduleAt[r.request_id] ?? ''}
                        disabled={busy}
                        onChange={(e) =>
                          setScheduleAt((prev) => ({ ...prev, [r.request_id]: e.target.value }))
                        }
                        className="w-auto"
                      />
                    </label>
                    <Button
                      disabled={busy}
                      onClick={() => handleSchedule(r)}
                      icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
                    >
                      {busy ? 'Scheduling…' : 'Schedule pickup'}
                    </Button>
                  </div>
                )}

                {r.request_status === 'collected' && (
                  <div className="border-t border-line pt-4">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          r.request_id,
                          () => confirmCompleted(r.request_id),
                          'Collection marked as completed.',
                        )
                      }
                      className={BUTTON_PRIMARY}
                    >
                      {busy ? 'Confirming…' : 'Confirm collection completed'}
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
    </AppShell>
  )
}
