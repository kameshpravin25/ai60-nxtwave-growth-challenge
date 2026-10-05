import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/state'
import type { Seat } from '../types'

/** Social proof: a small toast when someone else claims a seat while you're on the page. */
export default function LiveToasts() {
  const { seats, me } = useApp()
  const seen = useRef<number | null>(null)
  const [toast, setToast] = useState<Seat | null>(null)

  useEffect(() => {
    if (seen.current === null) {
      if (seats.length) seen.current = seats.length
      return
    }
    if (seats.length > seen.current) {
      const newest = seats[seats.length - 1]
      if (newest.code !== me?.code) setToast(newest)
    }
    seen.current = seats.length
  }, [seats, me])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 4500)
    return () => window.clearTimeout(id)
  }, [toast])

  if (!toast) return null
  return (
    <div className="toast" role="status" key={toast.code}>
      <span className="toast-seat mono">#{toast.seat}</span>
      <span>
        <b>{toast.name}</b> from {toast.college} {toast.referredBy ? 'joined a batch' : 'claimed a seat'}
      </span>
    </div>
  )
}
