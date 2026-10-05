import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { CAMPAIGN_DAYS } from '../config'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { campaignBoard, tally } from '../lib/analytics'
import { CAPTAINS, CLUBS } from '../data/demoWorld'
import { copyText, downloadBlob, workshopWhen } from '../lib/share'
import { renderPoster } from '../lib/poster'
import { toBlob } from '../lib/ticket'
import { dayIndex, formatDay, relative } from '../lib/time'

const PAYOUT_SLOTS = 4

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      className="btn btn-sm btn-ghost"
      onClick={async () => {
        setDone(await copyText(text))
        window.setTimeout(() => setDone(false), 1400)
      }}
    >
      {done ? 'Copied ✓' : label}
    </button>
  )
}

export default function Captain({ code }: { code: string }) {
  const { seats, now, campaign, loaded, mode } = useApp()
  const captain = CAPTAINS.find((c) => c.code === code)
  const club = CLUBS.find((c) => c.code === code)
  const source = club ? 'club' : 'captain'
  const board = useMemo(() => campaignBoard(seats, source, now), [seats, source, now])
  const rank = board.findIndex((b) => b.code === code) + 1
  const row = board.find((b) => b.code === code)
  const mine = seats.filter((s) => s.campaign === code)
  const college = captain?.college ?? club?.college ?? row?.college ?? '—'
  const name = captain?.name ?? club?.name ?? code
  const colleges = tally(seats, (s) => s.college)
  const collegeRank = colleges.findIndex((c) => c.key === college) + 1
  const collegeSeats = colleges.find((c) => c.key === college)?.count ?? 0
  const today = dayIndex(now, campaign.start)
  const perDay = Array.from({ length: CAMPAIGN_DAYS }, (_, i) => mine.filter((s) => dayIndex(s.createdAt, campaign.start) === i).length)
  const maxDay = Math.max(1, ...perDay)
  const link = `${window.location.origin}/?${source === 'club' ? 'src=club&' : ''}cap=${code}`
  const cutoff = board[PAYOUT_SLOTS - 1]?.count ?? 0
  const inZone = source === 'captain' && rank > 0 && rank <= PAYOUT_SLOTS
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#16181D', light: '#FFFFFF' } }).then(setQr)
  }, [link])

  const kit = `Placement season question nobody prepares for: "Have you built anything with AI?" 🤔\n\nFree 60-min LIVE workshop. Any branch, no AI background. We build + deploy a real AI project, plus a certificate.\n\n${workshopWhen(campaign.workshopAt)} · 500 seats → ${link}`

  if (!loaded) return <div className="page-loading">Loading…</div>

  return (
    <div className="db captain">
      <header className="db-top">
        <div className="wrap db-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
            <span className="brand-text">
              <b>{source === 'club' ? 'Club page' : 'Campus Captain'}</b>
              <span>{code}</span>
            </span>
          </Link>
          <div className="db-top-meta">
            {mode === 'demo' && <span className="chip chip-warn">Demo data · simulated</span>}
            <Link href="/dashboard" className="linkish">
              All captains
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap db-main">
        <section className="captain-hero">
          <div>
            <span className="mono small-label">{captain?.role ?? (club ? 'Club / community' : 'Tracked link')}</span>
            <h1>Hi {name.split(' ')[0]}, here's your scoreboard.</h1>
            <p className="lede">
              {college} · every registration through your link counts here, live.
              {source === 'captain' && ` Top ${PAYOUT_SLOTS} captains when hall tickets close get ₹300 each.`}
            </p>
          </div>
          {source === 'captain' && (
            <div className={`zone-card ${inZone ? 'in' : 'out'}`}>
              {rank === 0 ? (
                <>
                  <b>Not on the board yet</b>
                  <span>Your first registration puts you on it. Post the kit in your class group.</span>
                </>
              ) : inZone ? (
                <>
                  <b>✓ In the ₹300 zone (#{rank})</b>
                  <span>{rank < board.length ? `${row!.count - (board[PAYOUT_SLOTS]?.count ?? 0)} seats ahead of #${PAYOUT_SLOTS + 1}. Keep posting.` : 'Keep posting.'}</span>
                </>
              ) : (
                <>
                  <b>#{rank}: {cutoff - (row?.count ?? 0) + 1} seats to the ₹300 zone</b>
                  <span>#{PAYOUT_SLOTS} has {cutoff}. One more class group can do it.</span>
                </>
              )}
            </div>
          )}
        </section>

        <section className="db-kpis captain-kpis">
          <div className="db-card db-hero">
            <span className="db-label">Registrations via your link</span>
            <span className="db-hero-num">{mine.length}</span>
            <span className="db-sub">{rank ? `#${rank} of ${board.length} ${source === 'club' ? 'clubs' : 'captains'}` : 'not ranked yet'}</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Last 24 hours</span>
            <span className="db-stat-num">{row?.last24h ?? 0}</span>
            <span className="db-sub">{row?.last24h ? 'momentum!' : 'time for a fresh post'}</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Today (Day {Math.min(CAMPAIGN_DAYS, today + 1)})</span>
            <span className="db-stat-num">{perDay[Math.min(CAMPAIGN_DAYS - 1, Math.max(0, today))]}</span>
            <span className="db-sub">{formatDay(now)}</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">{college}</span>
            <span className="db-stat-num">{collegeSeats}</span>
            <span className="db-sub">{collegeRank ? `#${collegeRank} college overall` : 'seats from your campus'}</span>
          </div>
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Your link</h3>
            <div className="captain-link">
              {qr && <img src={qr} alt={`QR code for ${link}`} width={180} height={180} />}
              <div>
                <code>{link.replace(/^https?:\/\//, '')}</code>
                <div className="row-btns">
                  <Copy text={link} label="Copy link" />
                  <Copy text={kit} label="Copy WhatsApp message" />
                  <button
                    className="btn btn-sm"
                    onClick={async () => {
                      const blob = await toBlob(await renderPoster({ link, college, captain: name, workshopAt: campaign.workshopAt }))
                      downloadBlob(blob, `AI60-poster-${code}.png`)
                    }}
                  >
                    Download notice-board poster
                  </button>
                </div>
                <p className="db-muted">Print the poster for the department notice board. The QR is your tracked link, so offline sign-ups count for you too.</p>
              </div>
            </div>
          </div>

          <figure className="db-card">
            <figcaption>
              <h3>Your registrations by day</h3>
              <p>Seven campaign days. Today is highlighted.</p>
            </figcaption>
            <div className="mini-cols" role="img" aria-label={`Registrations per day: ${perDay.join(', ')}`}>
              {perDay.map((n, i) => (
                <div key={i} className={`mc${i === today ? ' today' : ''}${i > today ? ' future' : ''}`} title={`Day ${i + 1}: ${n}`}>
                  <span className="mc-val">{i > today ? '' : n}</span>
                  <span className="mc-bar" style={{ height: `${(n / maxDay) * 100}%` }} />
                  <span className="mc-label mono">D{i + 1}</span>
                </div>
              ))}
            </div>
          </figure>
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Recent sign-ups through you</h3>
            {mine.length ? (
              <ul className="captain-recent">
                {[...mine]
                  .reverse()
                  .slice(0, 8)
                  .map((s) => (
                    <li key={s.code}>
                      <b>{s.name}</b>
                      <span className="db-muted">
                        {s.branch === 'OTHER' ? 'Other' : s.branch} · {s.college}
                      </span>
                      <time className="mono">{relative(s.createdAt, now)}</time>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="empty">No sign-ups yet. Your first post usually brings 10–20.</p>
            )}
          </div>
          <div className="db-card">
            <h3>Leaderboard</h3>
            <ol className="ref-board">
              {board.slice(0, 8).map((b, i) => (
                <li key={b.code} className={b.code === code ? 'is-me' : ''}>
                  <span className="mono rank">{i + 1}</span>
                  <span className="rb-name">
                    <b>{b.code === code ? 'You' : (CAPTAINS.find((c) => c.code === b.code)?.name ?? CLUBS.find((c) => c.code === b.code)?.name ?? b.code)}</b>
                    <small>{b.college}</small>
                  </span>
                  <span className="mono rb-count">{b.count}</span>
                  {source === 'captain' && i < PAYOUT_SLOTS && <span className="prize">₹300</span>}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  )
}
