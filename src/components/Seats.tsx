import { useMemo, useRef, useState, type MouseEvent } from 'react'
import { SEAT_CAP } from '../config'
import { useApp } from '../lib/state'
import { tally } from '../lib/analytics'
import { relative } from '../lib/time'
import { SecHead } from './ui'
import type { Seat } from '../types'

function SeatMap({ highlight }: { highlight: string }) {
  const { seats, me, inviter, now } = useApp()
  const gridRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ n: number; x: number; y: number } | null>(null)

  const myBatch = useMemo(() => new Set(me ? seats.filter((s) => s.referredBy === me.code).map((s) => s.seat) : []), [seats, me])

  const onMove = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-n]')
    const grid = gridRef.current
    if (!el || !grid) return setTip(null)
    const g = grid.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    setTip({ n: Number(el.dataset.n), x: r.left - g.left + r.width / 2, y: r.top - g.top })
  }

  const tipSeat: Seat | undefined = tip ? seats[tip.n - 1] : undefined

  return (
    <div className="seatmap-wrap">
      <div className="seatmap-stage mono" aria-hidden>
        ▼ STAGE · LIVE BUILD · MENTORS ▼
      </div>
      <div
        ref={gridRef}
        className="seatmap"
        onMouseMove={onMove}
        onMouseLeave={() => setTip(null)}
        role="img"
        aria-label={`Seating chart: ${Math.min(seats.length, SEAT_CAP)} of ${SEAT_CAP} seats allotted${me ? `, your seat is ${me.seat}` : ''}.`}
      >
        {Array.from({ length: SEAT_CAP }, (_, i) => {
          const n = i + 1
          const s = seats[i]
          let cls = 'seat'
          if (s) {
            cls += ' taken'
            if (highlight && s.college === highlight) cls += ' hl-college'
            if (now - s.createdAt < 20_000) cls += ' fresh'
            if (myBatch.has(n)) cls += ' batch'
            if (inviter?.seat === n) cls += ' inviter'
            if (me?.seat === n) cls += ' mine'
          } else if (n === seats.length + 1) cls += ' next'
          return <span key={n} className={cls} data-n={n} />
        })}
        {tip && (
          <div className="seat-tip" style={{ left: tip.x, top: tip.y }}>
            <span className="mono">Seat #{tip.n}</span>
            {tipSeat ? (
              <>
                <b>{me?.seat === tip.n ? 'You' : tipSeat.name}</b>
                <span>
                  {tipSeat.college} · {tipSeat.branch === 'OTHER' ? 'Other' : tipSeat.branch}
                </span>
              </>
            ) : (
              <b>{tip.n === seats.length + 1 ? 'Next up. Yours?' : 'Available'}</b>
            )}
          </div>
        )}
      </div>
      <ul className="seat-legend">
        <li>
          <span className="seat taken" /> Allotted
        </li>
        <li>
          <span className="seat" /> Available
        </li>
        {me && (
          <li>
            <span className="seat taken mine" /> You
          </li>
        )}
        {me && (
          <li>
            <span className="seat taken batch" /> Your batch
          </li>
        )}
        {inviter && !me && (
          <li>
            <span className="seat taken inviter" /> {inviter.name}
          </li>
        )}
        {highlight && (
          <li>
            <span className="seat taken hl-college" /> {highlight}
          </li>
        )}
      </ul>
      {seats.length > SEAT_CAP && <p className="waitlist-note mono">+{seats.length - SEAT_CAP} on the waitlist (overflow batch opens)</p>}
    </div>
  )
}

export default function Seats() {
  const { seats, me, inviter, now, mode } = useApp()
  const colleges = useMemo(() => tally(seats, (s) => s.college), [seats])
  const [picked, setPicked] = useState<string | null>(null)
  const highlight = picked ?? me?.college ?? inviter?.college ?? ''
  const top = colleges.slice(0, 8)
  const max = top[0]?.count ?? 1
  const latest = seats.slice(-6).reverse()

  return (
    <section className="section" id="seats">
      <div className="wrap">
        <SecHead
          no="04"
          kicker="Seating arrangement"
          page={4}
          title={
            <>
              Hall AI-60. <span className="hl">{Math.max(0, SEAT_CAP - seats.length)} seats</span> still unclaimed.
            </>
          }
          lede="Every filled square is a student who registered. Tap or hover a seat to see who. Pick a college to see how your campus is doing."
        />

        <div className="seats-grid">
          <div className="sheet seats-sheet">
            <div className="seats-toolbar">
              <label className="mono small-label" htmlFor="college-hl">
                Highlight college
              </label>
              <select id="college-hl" value={highlight} onChange={(e) => setPicked(e.target.value)}>
                <option value="">None</option>
                {colleges.slice(0, 20).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.key} ({c.count})
                  </option>
                ))}
              </select>
            </div>
            <SeatMap highlight={highlight} />
            {mode === 'demo' && <p className="demo-note mono">Demo mode: seats are simulated. Ones you register are real in this browser.</p>}
          </div>

          <aside className="notice">
            <div className="pin" aria-hidden />
            <p className="mono notice-ref">Circular No. AI60/2026/07</p>
            <h3>Inter-college standings</h3>
            <ol className="college-board">
              {top.map((c, i) => (
                <li key={c.key} className={c.key === highlight ? 'is-hl' : ''}>
                  <span className="mono rank">{i + 1}</span>
                  <span className="cb-name">{c.key}</span>
                  <span className="cb-bar" aria-hidden>
                    <span style={{ width: `${(c.count / max) * 100}%` }} />
                  </span>
                  <span className="mono cb-count">{c.count}</span>
                </li>
              ))}
            </ol>
            <p className="notice-foot">Top college at close gets a campus shout-out from NxtWave, live in the workshop.</p>

            <h4 className="mono small-label">Latest allotments</h4>
            <ul className="latest" aria-live="polite">
              {latest.map((s) => (
                <li key={s.code}>
                  <span className="mono">#{s.seat}</span>
                  <span>
                    <b>{s.code === me?.code ? 'You' : s.name}</b> · {s.college}
                  </span>
                  <time className="mono">{relative(s.createdAt, now)}</time>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </section>
  )
}
