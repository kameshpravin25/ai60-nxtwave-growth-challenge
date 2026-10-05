import { useMemo, useState, type MouseEvent } from 'react'
import { CAMPAIGN_DAYS, DAILY_TARGETS, SEAT_CAP } from '../config'
import { CAPTAINS, CLUBS } from '../data/demoWorld'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { campaignBoard, daily, insights, kFactor, pacing, referrerBoard, tally, type DayStat } from '../lib/analytics'
import { copyText, downloadBlob } from '../lib/share'
import { DAY, dayIndex, formatDay, formatTime, relative, startOfDayIST } from '../lib/time'
import { Countdown } from '../components/ui'
import type { PrivateSeat, Seat, Source } from '../types'

const SOURCE_LABEL: Record<Source, string> = {
  captain: 'Campus Captains (WhatsApp)',
  referral: 'Hall-ticket referrals',
  club: 'Clubs & communities',
  linkedin: 'LinkedIn',
  instagram: 'Instagram',
  email: 'Email',
  bot: 'WhatsApp bot',
  direct: 'Direct / unknown',
}
const BRANCH_LABEL: Record<string, string> = { OTHER: 'Other' }
const fmtInt = (n: number) => n.toLocaleString('en-IN')

/* ---------- Pacing chart: cumulative actual vs plan, with projection ---------- */

function PacingChart({ days, total, nowPos, projected }: { days: DayStat[]; total: number; nowPos: number; projected: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const [asTable, setAsTable] = useState(false)
  const W = 720
  const H = 300
  const m = { t: 18, r: 64, b: 40, l: 44 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const yMax = Math.max(SEAT_CAP, projected, total) * 1.06
  const x = (d: number) => m.l + (d / CAMPAIGN_DAYS) * iw
  const y = (v: number) => m.t + ih - (v / yMax) * ih

  const past = days.filter((d) => d.status === 'past')
  const actualPts: Array<[number, number]> = [[0, 0], ...past.map((d) => [d.index + 1, d.cumulative] as [number, number]), [nowPos, total]]
  const targetPts: Array<[number, number]> = [[0, 0], ...DAILY_TARGETS.map((t, i) => [i + 1, t] as [number, number])]
  const path = (pts: Array<[number, number]>) => pts.map(([d, v], i) => `${i ? 'L' : 'M'}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const ticks = [0, 100, 200, 300, 400, 500].filter((t) => t <= yMax)

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const d = Math.floor(((e.clientX - box.left) / box.width) * CAMPAIGN_DAYS)
    setHover(Math.min(CAMPAIGN_DAYS - 1, Math.max(0, d)))
  }
  const h = hover !== null ? days[hover] : null
  const hVal = h ? (h.status === 'past' ? h.cumulative : h.status === 'today' ? total : null) : null

  return (
    <figure className="db-card db-chart">
      <figcaption className="db-chart-head">
        <div>
          <h3>Registrations vs plan</h3>
          <p>Cumulative seats, day by day. Plan = the 7-day target curve from the growth plan.</p>
        </div>
        <ul className="db-legend">
          <li>
            <span className="key key-actual" /> Actual
          </li>
          <li>
            <span className="key key-target" /> Plan
          </li>
          <li>
            <span className="key key-proj" /> Projection
          </li>
        </ul>
      </figcaption>

      {asTable ? (
        <table className="db-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Date</th>
              <th className="num">New</th>
              <th className="num">Cumulative</th>
              <th className="num">Plan</th>
              <th className="num">Gap</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.index}>
                <td>Day {d.index + 1}</td>
                <td>{formatDay(d.date)}</td>
                <td className="num">{d.status === 'future' ? '—' : d.count}</td>
                <td className="num">{d.status === 'future' ? '—' : d.cumulative}</td>
                <td className="num">{d.target}</td>
                <td className="num">{d.status === 'past' ? (d.cumulative - d.target > 0 ? '+' : '') + (d.cumulative - d.target) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="db-svg-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative registrations: ${total} now, plan ${DAILY_TARGETS[CAMPAIGN_DAYS - 1]} by day 7, projected ${projected}.`}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} />
                <text className="tick" x={m.l - 8} y={y(t) + 4} textAnchor="end">
                  {t}
                </text>
              </g>
            ))}
            {days.map((d) => (
              <text key={d.index} className={`tick${d.status === 'today' ? ' today' : ''}`} x={x(d.index + 0.5)} y={H - m.b + 20} textAnchor="middle">
                D{d.index + 1}
              </text>
            ))}
            <rect className="today-band" x={x(Math.floor(nowPos))} y={m.t} width={iw / CAMPAIGN_DAYS} height={ih} />
            <line className="goal" x1={m.l} x2={W - m.r} y1={y(SEAT_CAP)} y2={y(SEAT_CAP)} />
            <text className="goal-label" x={m.l + 6} y={y(SEAT_CAP) - 7}>
              Goal · {SEAT_CAP}
            </text>

            <path className="line-target" d={path(targetPts)} />
            <path className="line-proj" d={`M${x(nowPos)},${y(total)} L${x(CAMPAIGN_DAYS)},${y(projected)}`} />
            <path className="area-actual" d={`${path(actualPts)} L${x(nowPos)},${y(0)} L${x(0)},${y(0)} Z`} />
            <path className="line-actual" d={path(actualPts)} />
            <circle className="dot-actual" cx={x(nowPos)} cy={y(total)} r={5} />
            <text className="end-label" x={x(nowPos) + 10} y={y(total) - 10}>
              {total} now
            </text>
            <text className="end-label muted" x={x(CAMPAIGN_DAYS) + 6} y={y(projected) + 4}>
              ~{projected}
            </text>

            {h && (
              <g className="crosshair">
                <line x1={x(h.index + 1)} x2={x(h.index + 1)} y1={m.t} y2={m.t + ih} />
                {hVal !== null && <circle className="dot-actual" cx={x(h.status === 'today' ? nowPos : h.index + 1)} cy={y(hVal)} r={5} />}
                <circle className="dot-target" cx={x(h.index + 1)} cy={y(h.target)} r={4.5} />
              </g>
            )}
            <rect x={m.l} y={m.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
          </svg>
          {h && (
            <div className="db-tip" style={{ left: `${(x(h.index + 1) / W) * 100}%` }}>
              <b>
                Day {h.index + 1} · {formatDay(h.date)}
              </b>
              <span>
                <i className="key key-actual" /> Actual: {hVal ?? '—'}
                {h.status === 'today' ? ' (so far)' : ''}
              </span>
              <span>
                <i className="key key-target" /> Plan by end of day: {h.target}
              </span>
              {h.status !== 'future' && <span>New that day: {h.count}</span>}
            </div>
          )}
        </div>
      )}
      <button className="linkish db-toggle" onClick={() => setAsTable(!asTable)}>
        {asTable ? 'Show chart' : 'Show as table'}
      </button>
    </figure>
  )
}

/* ---------- Horizontal bar list (single series; value at the tip) ---------- */

function BarList({ title, sub, rows, total }: { title: string; sub: string; rows: Array<{ label: string; count: number }>; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count))
  return (
    <figure className="db-card">
      <figcaption>
        <h3>{title}</h3>
        <p>{sub}</p>
      </figcaption>
      <ul className="barlist">
        {rows.map((r) => (
          <li key={r.label} tabIndex={0} title={`${r.label}: ${r.count} (${Math.round((r.count / total) * 100)}%)`}>
            <span className="bl-label">{r.label}</span>
            <span className="bl-track">
              <span className="bl-bar" style={{ width: `${(r.count / max) * 100}%` }} />
              <span className="bl-val">
                {r.count} <small>{Math.round((r.count / total) * 100)}%</small>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

/* ---------- Link builder + WhatsApp kit ---------- */

function LinkBuilder() {
  const [type, setType] = useState<'captain' | 'club' | 'linkedin' | 'instagram' | 'email'>('captain')
  const [college, setCollege] = useState('CBIT')
  const [person, setPerson] = useState('Rahul')
  const [copied, setCopied] = useState<string | null>(null)

  const code = `${college}-${person}`
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, '')
    .slice(0, 30)
  const origin = window.location.origin
  const url =
    type === 'captain' ? `${origin}/?cap=${code}` : type === 'club' ? `${origin}/?src=club&cap=${code}` : `${origin}/?src=${type}${code ? `&cap=${code}` : ''}`

  const kit = `Hi ${person || 'there'}! Thanks for being an AI60 Campus Captain 🙌\n\nPaste this in your class / placement group:\n\n"Placement season question nobody prepares for: 'Have you built anything with AI?'\n\nFree 60-min LIVE workshop. Any branch, no AI background. We build + deploy a real AI project and get a certificate.\n\nGrab a hall ticket (500 seats only) 👉 ${url}"\n\nYour link tracks every registration live on the leaderboard. Top 4 captains get ₹300 each.`

  const copy = async (text: string, key: string) => {
    if (await copyText(text)) {
      setCopied(key)
      window.setTimeout(() => setCopied(null), 1500)
    }
  }

  return (
    <div className="db-card">
      <h3>Tracked link builder</h3>
      <p className="db-muted">Every captain, club and post gets its own link, so the console can attribute each seat and payouts stay honest.</p>
      <div className="lb-form">
        <label>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="captain">Campus Captain</option>
            <option value="club">Club / community</option>
            <option value="linkedin">LinkedIn post</option>
            <option value="instagram">Instagram</option>
            <option value="email">Email</option>
          </select>
        </label>
        <label>
          <span>College / group</span>
          <input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="CBIT" />
        </label>
        <label>
          <span>Person / handle</span>
          <input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Rahul" />
        </label>
      </div>
      <div className="lb-out">
        <code>{url}</code>
        <button className="btn btn-sm" onClick={() => copy(url, 'url')}>
          {copied === 'url' ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      {(type === 'captain' || type === 'club') && code && (
        <p className="db-muted">
          Their personal scoreboard: <Link href={`/captain/${code}`}>/captain/{code}</Link> (rank, payout zone, QR poster).
        </p>
      )}
      {(type === 'captain' || type === 'club') && (
        <>
          <pre className="lb-kit">{kit}</pre>
          <button className="btn btn-ghost btn-sm" onClick={() => copy(kit, 'kit')}>
            {copied === 'kit' ? 'Copied ✓' : 'Copy WhatsApp kit'}
          </button>
        </>
      )}
    </div>
  )
}

function Templates({ workshopAt }: { workshopAt: number }) {
  const [copied, setCopied] = useState<number | null>(null)
  const link = `${window.location.origin}/`
  const when = `${formatDay(workshopAt)}, ${formatTime(workshopAt)} IST`
  const items = [
    { when: 'Day 1–2 · via captains', who: 'Class & placement groups', text: `Placement season question nobody prepares for: "Have you built anything with AI?" 🤔\n\nFree 60-min LIVE workshop. Any branch, no AI background. We build + deploy a real AI project, plus a certificate.\n\n${when} · 500 seats → ${link}` },
    { when: 'Right after registering', who: 'Each registrant (auto)', text: `You're in! 🎟️ Seat #{seat}.\n\nYour project batch is 4 people. Send them your link: when 3 join, your hall ticket turns GOLD and your batch gets priority Q&A.\n\n{invite_link}` },
    { when: 'Day 5 · if behind pace', who: 'Registrants with 0 referrals', text: `Quick one: your batchmates still don't have seats 👀 Only {left} left.\n\nForward your hall ticket → {invite_link}` },
    { when: 'Day 6 · scarcity', who: 'Captains + clubs', text: `⚠️ Last {left} seats for "Build Your First AI Project in 60 Minutes" (${when}).\n\nCurrent leaderboard: {top_college} is leading. Is your college on it? → ${link}` },
    { when: 'T − 24 hours', who: 'All registrants', text: `Tomorrow ${formatTime(workshopAt)}! 2-minute checklist so you build instead of signing up live:\n1. Get a free Gemini API key: aistudio.google.com\n2. Create a Hugging Face account\n3. Laptop + Chrome. Done. See you there 🚀` },
    { when: 'T − 1 hour', who: 'All registrants', text: `AI60 starts in 1 hour ⏰\nJoin: {join_link}\nKeep your Gemini key ready. Bring your batch!` },
    { when: 'T + 2 hours', who: 'Attendees', text: `You built an AI project today 🎉 Submit your live URL within 48h for your certificate: {submit_link}\n\nYour resume line + LinkedIn post template are inside.` },
  ]
  return (
    <div className="db-card">
      <h3>WhatsApp sequence</h3>
      <p className="db-muted">Registration is half the job. Attendance is the other half. Seven messages, each with a trigger.</p>
      <ol className="tpl-list">
        {items.map((t, i) => (
          <li key={i}>
            <div className="tpl-head">
              <span className="mono">{t.when}</span>
              <span className="db-muted">{t.who}</span>
              <button
                className="linkish"
                onClick={async () => {
                  if (await copyText(t.text)) {
                    setCopied(i)
                    window.setTimeout(() => setCopied(null), 1500)
                  }
                }}
              >
                {copied === i ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <pre>{t.text}</pre>
          </li>
        ))}
      </ol>
    </div>
  )
}

/* ---------- Export ---------- */

function toCsv(rows: PrivateSeat[]): string {
  const cols: Array<[string, (r: PrivateSeat) => string | number]> = [
    ['seat', (r) => r.seat],
    ['code', (r) => r.code],
    ['full_name', (r) => r.fullName],
    ['phone', (r) => r.phone],
    ['email', (r) => r.email],
    ['college', (r) => r.college],
    ['branch', (r) => r.branch],
    ['grad_year', (r) => r.gradYear],
    ['source', (r) => r.source],
    ['campaign', (r) => r.campaign ?? ''],
    ['referred_by', (r) => r.referredBy ?? ''],
    ['registered_at', (r) => new Date(r.createdAt).toISOString()],
  ]
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.map((c) => c[0]).join(','), ...rows.map((r) => cols.map(([, f]) => esc(f(r))).join(','))].join('\n')
}

function Export() {
  const { mode, exportRows } = useApp()
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const run = async () => {
    setMsg(null)
    try {
      const rows = await exportRows(key)
      downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv' }), `ai60-registrations-${new Date().toISOString().slice(0, 10)}.csv`)
      setMsg(`Exported ${rows.length} rows.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed')
    }
  }
  return (
    <div className="db-card">
      <h3>Export for reminders & certificates</h3>
      <p className="db-muted">
        CSV with phone and email, for the WhatsApp reminder broadcast and certificate mail-merge.{' '}
        {mode === 'live' ? 'Requires the organiser key (set in Supabase).' : 'Demo: seeded rows get synthetic @example.com contacts.'}
      </p>
      <div className="lb-out">
        {mode === 'live' && <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Organiser key" aria-label="Organiser key" />}
        <button className="btn btn-sm" onClick={run}>
          Download CSV
        </button>
      </div>
      {msg && <p className="db-muted">{msg}</p>}
    </div>
  )
}

/* ---------- Page ---------- */

const TONE_ICON = { good: '✓', warn: '!', bad: '✕' } as const
const TONE_LABEL = { good: 'Good', warn: 'Watch', bad: 'Act now' } as const

export default function Dashboard() {
  const { seats, campaign, now, mode, loaded } = useApp()
  const p = useMemo(() => pacing(seats, campaign, now), [seats, campaign, now])
  const days = useMemo(() => daily(seats, campaign, now), [seats, campaign, now])
  const tips = useMemo(() => insights(seats, campaign, now), [seats, campaign, now])
  const captains = useMemo(() => campaignBoard(seats, 'captain', now), [seats, now])
  const clubs = useMemo(() => campaignBoard(seats, 'club', now), [seats, now])
  const sources = tally(seats, (s) => s.source).map((r) => ({ label: SOURCE_LABEL[r.key], count: r.count }))
  const branches = tally(seats, (s) => s.branch).map((r) => ({ label: BRANCH_LABEL[r.key] ?? r.key, count: r.count }))
  const refs = referrerBoard(seats, 5)
  const k = kFactor(seats)
  const finalYears = seats.filter((s) => s.gradYear === 2027).length
  const idx = Math.min(CAMPAIGN_DAYS - 1, Math.max(0, dayIndex(now, campaign.start)))
  const nowPos = idx + Math.min(1, (now - (startOfDayIST(campaign.start) + idx * DAY)) / DAY)
  const capInfo = new Map(CAPTAINS.map((c) => [c.code, c]))
  const clubInfo = new Map(CLUBS.map((c) => [c.code, c]))
  const recent: Seat[] = seats.slice(-10).reverse()

  if (!loaded) return <div className="page-loading">Loading console…</div>
  const total = Math.max(1, seats.length)

  return (
    <div className="db">
      <header className="db-top">
        <div className="wrap db-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
            <span className="brand-text">
              <b>Organiser console</b>
              <span>Campaign war room</span>
            </span>
          </Link>
          <div className="db-top-meta">
            <span className="chip chip-ink">
              Day {p.day} of {CAMPAIGN_DAYS}
            </span>
            <span className="chip">
              Workshop in <Countdown to={campaign.workshopAt} compact />
            </span>
            <span className={`chip ${mode === 'demo' ? 'chip-warn' : 'chip-good'}`}>{mode === 'demo' ? 'Demo data · simulated' : 'Live · Supabase'}</span>
            <Link href="/host" className="linkish">
              Host console
            </Link>
            <Link href="/whatsapp" className="linkish">
              WhatsApp bot
            </Link>
            <Link href="/plan" className="linkish">
              Growth plan →
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap db-main">
        {mode === 'demo' && (
          <p className="db-demo">
            <b>Demo mode.</b> This console runs on a simulated campaign that is always on Day 5, with fictional captains and students, so you can see how it behaves mid-campaign. Registrations you make on the
            landing page appear here instantly. Connect Supabase (see README) to run it on real data.
          </p>
        )}

        <section className="db-kpis" aria-label="Key numbers">
          <div className="db-card db-hero">
            <span className="db-label">Registrations</span>
            <span className="db-hero-num">{fmtInt(seats.length)}</span>
            <span className="db-sub">
              of {SEAT_CAP} goal · {Math.round((seats.length / SEAT_CAP) * 100)}%
            </span>
            <div className="db-meter" aria-hidden>
              <span style={{ width: `${Math.min(100, (seats.length / SEAT_CAP) * 100)}%` }} />
              <i style={{ left: `${(p.targetNow / SEAT_CAP) * 100}%` }} title="Plan by now" />
            </div>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Plan by now</span>
            <span className="db-stat-num">{p.targetNow}</span>
            <span className={`db-delta ${p.gap >= 0 ? 'up' : 'down'}`}>
              {p.gap >= 0 ? '▲' : '▼'} {Math.abs(p.gap)} {p.gap >= 0 ? 'ahead' : 'behind'}
            </span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Needed per day</span>
            <span className="db-stat-num">{p.requiredPerDay}</span>
            <span className="db-sub">for {p.daysLeft.toFixed(1)} days left</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Projected finish</span>
            <span className="db-stat-num">{p.projected}</span>
            <span className="db-sub">at the last 2 days' run-rate</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Referral k-factor</span>
            <span className="db-stat-num">{k.toFixed(2)}</span>
            <span className="db-sub">referred seats per non-referred seat</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Final-years</span>
            <span className="db-stat-num">{Math.round((finalYears / total) * 100)}%</span>
            <span className="db-sub">class of 2027 (the target)</span>
          </div>
        </section>

        <section className="db-row db-row-chart">
          <PacingChart days={days} total={seats.length} nowPos={nowPos} projected={p.projected} />
          <div className="db-card db-insights">
            <h3>What to do today</h3>
            <ul>
              {tips.map((t) => (
                <li key={t.title} className={`ins ins-${t.tone}`}>
                  <span className="ins-icon" aria-hidden>
                    {TONE_ICON[t.tone]}
                  </span>
                  <div>
                    <span className="ins-tag">{TONE_LABEL[t.tone]}</span>
                    <b>{t.title}</b>
                    <p>{t.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="db-row db-row-2">
          <BarList title="Seats by channel" sub="Where each registration came from (tracked links)." rows={sources} total={total} />
          <BarList title="Seats by branch" sub="Branch-specific projects are meant to widen this beyond CSE." rows={branches} total={total} />
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Campus Captains</h3>
            <p className="db-muted">Paid on results: top 4 by verified seats get ₹300 each. Stalled captains get a call.</p>
            <div className="table-scroll">
              <table className="db-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Captain</th>
                    <th>College</th>
                    <th className="num">Seats</th>
                    <th className="num">24h</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {captains.map((c, i) => {
                    const info = capInfo.get(c.code)
                    const stalled = c.last24h === 0
                    return (
                      <tr key={c.code}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <Link href={`/captain/${c.code}`}>
                            <b>{info?.name ?? c.code}</b>
                          </Link>
                          <small className="db-muted block">{info ? `${info.role} · ${c.code}` : 'tracked link'}</small>
                        </td>
                        <td>{info?.college ?? c.college}</td>
                        <td className="num">{c.count}</td>
                        <td className="num">{c.last24h}</td>
                        <td>
                          {i < 4 ? (
                            <span className="status s-good">✓ ₹300 zone</span>
                          ) : stalled ? (
                            <span className="status s-warn">! Stalled</span>
                          ) : (
                            <span className="status s-neutral">Active</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="db-stack">
            <div className="db-card">
              <h3>Clubs & communities</h3>
              <table className="db-table">
                <thead>
                  <tr>
                    <th>Club</th>
                    <th className="num">Seats</th>
                    <th className="num">24h</th>
                  </tr>
                </thead>
                <tbody>
                  {clubs.map((c) => (
                    <tr key={c.code}>
                      <td>
                        <b>{clubInfo.get(c.code)?.name ?? c.code}</b>
                        <small className="db-muted block">{c.college}</small>
                      </td>
                      <td className="num">{c.count}</td>
                      <td className="num">{c.last24h}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="db-card">
              <h3>Top student referrers</h3>
              <table className="db-table">
                <tbody>
                  {refs.map((r, i) => (
                    <tr key={r.seat.code}>
                      <td className="num">{i + 1}</td>
                      <td>
                        <b>{r.seat.name}</b>
                        <small className="db-muted block">
                          {r.seat.college} · {r.seat.code}
                        </small>
                      </td>
                      <td className="num">{r.count}</td>
                      <td>{i < 3 && <span className="status s-good">₹{[250, 150, 100][i]}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="db-row db-row-2">
          <LinkBuilder />
          <Templates workshopAt={campaign.workshopAt} />
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Latest registrations</h3>
            <div className="table-scroll">
              <table className="db-table">
                <thead>
                  <tr>
                    <th className="num">Seat</th>
                    <th>Student</th>
                    <th>Channel</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((s) => (
                    <tr key={s.code}>
                      <td className="num">{s.seat}</td>
                      <td>
                        <b>{s.name}</b>
                        <small className="db-muted block">
                          {s.college} · {BRANCH_LABEL[s.branch] ?? s.branch}
                        </small>
                      </td>
                      <td>
                        {SOURCE_LABEL[s.source]}
                        <small className="db-muted block">{s.campaign ?? (s.referredBy ? `via ${s.referredBy}` : '')}</small>
                      </td>
                      <td className="mono nowrap">{relative(s.createdAt, now)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Export />
        </section>
      </main>
    </div>
  )
}
