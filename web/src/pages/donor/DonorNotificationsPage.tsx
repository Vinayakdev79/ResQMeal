import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from '../../lib/donorApi'
import type { DonorNotification } from '../../lib/donorApi'
import { useAuth } from '../../auth/useAuth'
import AppShell from '../../components/AppShell'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.'
}

function typeLabel(type: string): string {
  const spaced = type.replace(/_/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export default function DonorNotificationsPage() {
  const { user } = useAuth()
  const userId = user?.id

  const [items, setItems] = useState<DonorNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  // Initial load (re-runs on Retry).
  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    listNotifications(userId)
      .then((rows) => {
        if (!cancelled) setItems(rows)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errMsg(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [userId, reloadKey])

  // Realtime inserts: prepend new notifications, unsubscribe on unmount.
  useEffect(() => {
    if (!userId) return
    const unsubscribe = subscribeToNotifications(userId, (incoming: DonorNotification) => {
      setItems((prev) => [incoming, ...prev.filter((n) => n.id !== incoming.id)])
    })
    return () => {
      unsubscribe()
    }
  }, [userId])

  async function handleMarkRead(id: string) {
    setBusyId(id)
    setActionError(null)
    try {
      await markNotificationRead(id)
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    } catch (e) {
      setActionError(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  async function handleMarkAll() {
    if (!userId) return
    setMarkingAll(true)
    setActionError(null)
    try {
      await markAllNotificationsRead(userId)
      setItems((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (e) {
      setActionError(errMsg(e))
    } finally {
      setMarkingAll(false)
    }
  }

  const unreadCount = items.filter((n) => !n.is_read).length

  return (
    <AppShell title="Notifications">
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-charcoal">Notifications</h1>
          <p className="text-sm text-gray-600">
            {unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleMarkAll()}
          disabled={markingAll || unreadCount === 0}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {markingAll ? 'Marking…' : 'Mark all as read'}
        </button>
      </header>

      {actionError && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-600">Loading notifications…</p>
      ) : error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => setReloadKey((k) => k + 1)}
            className="mt-2 inline-flex items-center gap-1 font-semibold underline"
          >
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-lg bg-white px-4 py-6 text-center text-sm text-gray-600">
          No notifications yet. You will be notified when receivers request your food or pickups
          change.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex flex-wrap items-start justify-between gap-3 rounded-xl p-4 shadow-sm ${
                n.is_read ? 'bg-white' : 'border-l-4 border-primary bg-primary/5'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.is_read ? 'text-gray-700' : 'font-semibold text-charcoal'}`}>
                  {n.message}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {typeLabel(n.type)} · {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => void handleMarkRead(n.id)}
                  disabled={busyId === n.id}
                  className="rounded-lg border border-primary px-3 py-1 text-xs font-semibold text-primary disabled:opacity-50"
                >
                  {busyId === n.id ? 'Saving…' : 'Mark read'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    </AppShell>
  )
}
