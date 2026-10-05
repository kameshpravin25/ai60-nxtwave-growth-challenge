import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SEAT_CAP } from '../config'
import { countdownParts, pad } from '../lib/time'
import { renderTicket, toBlob, type TicketData } from '../lib/ticket'

export function Countdown({ to, compact = false }: { to: number; compact?: boolean }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  const ms = to - now
  if (ms <= 0) return <span className="countdown live-now">Live now</span>
  const { d, h, m, s } = countdownParts(ms)
  if (compact) return <span className="countdown mono">{d}d {pad(h)}h {pad(m)}m</span>
  return (
    <span className="countdown" role="timer" aria-label={`${d} days ${h} hours ${m} minutes`}>
      {[
        [d, 'd'],
        [h, 'h'],
        [m, 'm'],
        [s, 's'],
      ].map(([v, u]) => (
        <span key={u} className="cd-unit">
          <b>{pad(v as number)}</b>
          <i>{u}</i>
        </span>
      ))}
    </span>
  )
}

/** 50 cells × 10 seats. Reads instantly as "how full is it". */
export function SeatMeter({ taken, compact = false }: { taken: number; compact?: boolean }) {
  const cells = 50
  const filled = Math.min(cells, Math.floor((taken / SEAT_CAP) * cells))
  const left = Math.max(0, SEAT_CAP - taken)
  return (
    <div className={`seat-meter${compact ? ' compact' : ''}`}>
      <div className="seat-meter-bar" role="progressbar" aria-valuemin={0} aria-valuemax={SEAT_CAP} aria-valuenow={taken} aria-label="Seats allotted">
        {Array.from({ length: cells }, (_, i) => (
          <span key={i} className={i < filled ? 'on' : i === filled ? 'next' : ''} />
        ))}
      </div>
      <div className="seat-meter-text">
        <span>
          <b className="mono">{Math.min(taken, SEAT_CAP)}</b> of {SEAT_CAP} seats allotted
        </span>
        <span className="seat-left">{left > 0 ? `${left} left` : 'Waitlist open'}</span>
      </div>
    </div>
  )
}

export function TicketImage({ data, className = '', alt }: { data: TicketData; className?: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const key = JSON.stringify(data)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    renderTicket(data)
      .then(toBlob)
      .then((blob) => {
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = url
        setSrc(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [key]) // data is compared by value via `key`

  useEffect(() => () => void (urlRef.current && URL.revokeObjectURL(urlRef.current)), [])

  return src ? <img className={`ticket-img ${className}`} src={src} alt={alt} width={1080} height={1350} /> : <div className={`ticket-img ticket-skeleton ${className}`} aria-hidden />
}

export function SecHead({ no, kicker, title, lede, page }: { no: string; kicker: string; title: ReactNode; lede?: ReactNode; page: number }) {
  return (
    <header className="sec-head">
      <div className="sec-meta">
        <span className="mono sec-no">
          Expt. No. {no} <span className="sep">/</span> {kicker}
        </span>
        <span className="notebook-meta" aria-hidden>
          Page No. <u>{pad(page)}</u>
        </span>
      </div>
      <h2>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
    </header>
  )
}

export function Scribble({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`scribble ${className}`}>{children}</span>
}

export function Arrow({ className = '' }: { className?: string }) {
  return (
    <svg className={`hand-arrow ${className}`} viewBox="0 0 120 60" fill="none" aria-hidden>
      <path d="M4 10 C 30 50, 70 54, 108 30" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M94 22 L 110 29 L 98 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
