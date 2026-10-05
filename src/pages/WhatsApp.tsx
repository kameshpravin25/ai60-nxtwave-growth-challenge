import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { FLOW_MAP, newSession, scheduled, step, type WaDeps, type WaIn, type WaOut, type WaSession } from '../lib/wa/flow'
import { googleCalendarUrl, workshopWhen } from '../lib/share'
import { shareLink } from '../lib/attribution'
import { TicketImage } from '../components/ui'
import type { Branch } from '../types'
import type { EvalEvent } from '../../api/_lib/evaluator'
import { SEAT_CAP } from '../config'

interface ChatMsg {
  id: string
  from: 'bot' | 'user'
  at: number
  out?: WaOut
  text?: string
  template?: boolean
}

interface Saved {
  phone: string
  session: WaSession
  messages: ChatMsg[]
}

const KEY = 'ai60_wa_v1'
const uid = () => Math.random().toString(36).slice(2, 9)
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })

function load(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Saved
  } catch {
    /* fall through */
  }
  return { phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, session: newSession(), messages: [] }
}

async function evaluateViaApi(input: Parameters<NonNullable<WaDeps['evaluate']>>[0]) {
  const res = await fetch('/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...input, project: 'My AI project' }) })
  if (!res.ok || !res.body) throw new Error('Evaluator unavailable')
  const text = await res.text()
  const result = text
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as EvalEvent)
    .find((e): e is Extract<EvalEvent, { type: 'result' }> => e.type === 'result')
  if (!result) throw new Error('Evaluation failed')
  return { total: result.total, pass: result.pass, reasons: result.reasons, fixes: result.grade.fixes, certificateUrl: result.certificate ? `${window.location.origin}/verify/${result.certificate}` : null }
}

function Bubble({ m, onReply, session, workshopAt }: { m: ChatMsg; onReply: (input: WaIn, title: string) => void; session: WaSession; workshopAt: number }) {
  const [sheet, setSheet] = useState(false)
  const time = timeFmt.format(m.at)
  if (m.from === 'user') {
    return (
      <div className="wa-row out">
        <div className="wa-bubble out">
          <span className="wa-text">{m.text}</span>
          <span className="wa-meta">
            {time} <span className="wa-ticks">✓✓</span>
          </span>
        </div>
      </div>
    )
  }
  const out = m.out!
  const body = (t: string) => <span className="wa-text" dangerouslySetInnerHTML={{ __html: formatWa(t) }} />
  return (
    <div className="wa-row in">
      <div className="wa-stack">
        <div className="wa-bubble in">
          {m.template && <span className="wa-template">Template message</span>}
          {out.type === 'ticket' ? (
            <>
              <div className="wa-image">
                <TicketImage
                  alt={`Hall ticket seat ${out.seat}`}
                  data={{
                    name: session.data.name ?? out.name,
                    college: session.data.college ?? '',
                    branch: session.data.branch === 'OTHER' ? 'Other' : (session.data.branch ?? ''),
                    gradYear: session.data.year ?? 2027,
                    seat: out.seat,
                    code: out.code,
                    workshopAt,
                    link: shareLink(out.code),
                    tier: 'standard',
                    refCount: 0,
                  }}
                />
              </div>
              {body(out.caption)}
            </>
          ) : (
            body(out.text)
          )}
          <span className="wa-meta">{time}</span>
        </div>
        {out.type === 'buttons' &&
          out.buttons.map((b) => (
            <button key={b.id} className="wa-btn" onClick={() => onReply({ type: 'reply', id: b.id, title: b.title }, b.title)}>
              {b.title}
            </button>
          ))}
        {out.type === 'cta' && (
          <a className="wa-btn" href={out.url} target="_blank" rel="noreferrer">
            ↗ {out.label}
          </a>
        )}
        {out.type === 'list' && (
          <>
            <button className="wa-btn" onClick={() => setSheet(true)}>
              ☰ {out.button}
            </button>
            {sheet && (
              <div className="wa-sheet" role="dialog" aria-label={out.button}>
                <div className="wa-sheet-head">
                  <button onClick={() => setSheet(false)} aria-label="Close">
                    ×
                  </button>
                  <b>{out.button}</b>
                </div>
                <ul>
                  {out.rows.map((r) => (
                    <li key={r.id}>
                      <button
                        onClick={() => {
                          setSheet(false)
                          onReply({ type: 'reply', id: r.id, title: r.title }, r.title)
                        }}
                      >
                        <span>
                          {r.title}
                          {r.description && <small>{r.description}</small>}
                        </span>
                        <i aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** WhatsApp's *bold* and _italic_, safely: escape first, then format. */
function formatWa(t: string): string {
  return t
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\n/g, '<br/>')
}

export default function WhatsApp() {
  const { campaign, seats, registerOther, mode } = useApp()
  const [state, setState] = useState<Saved>(load)
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const scroller = useRef<HTMLDivElement>(null)
  const latest = useRef(state)
  latest.current = state
  const busy = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [state, typing])

  const deps: WaDeps = {
    phone: state.phone,
    siteUrl: window.location.origin,
    workshopLabel: workshopWhen(campaign.workshopAt),
    calendarUrl: googleCalendarUrl(campaign.workshopAt),
    register: async (input) => {
      const r = await registerOther({ ...input, branch: input.branch as Branch, referredBy: null, source: 'bot', campaign: 'WA-BOT' })
      return { seat: r.seat.seat, code: r.seat.code, name: r.seat.name, existing: r.existing }
    },
    evaluate: evaluateViaApi,
  }

  const botSay = async (session: WaSession, replies: WaOut[], template = false) => {
    for (const out of replies) {
      setTyping(true)
      await new Promise((r) => setTimeout(r, 450 + Math.min(900, ('text' in out ? out.text.length : 40) * 6)))
      setTyping(false)
      setState((prev) => ({ ...prev, session, messages: [...prev.messages, { id: uid(), from: 'bot', at: Date.now(), out, template }] }))
    }
    setState((prev) => ({ ...prev, session }))
  }

  const send = async (input: WaIn, shown: string) => {
    if (busy.current) return
    busy.current = true
    const current = latest.current.session
    setState((prev) => ({ ...prev, messages: [...prev.messages, { id: uid(), from: 'user', at: Date.now(), text: shown }] }))
    if (current.node === 'submit_desc' && input.type === 'text') setTyping(true)
    try {
      const { session, replies } = await step(current, input, deps)
      await botSay(session, replies)
    } catch (e) {
      setTyping(false)
      await botSay(current, [{ type: 'text', text: `⚠️ ${e instanceof Error ? e.message : 'Something went wrong'}. Please try again.` }])
    } finally {
      busy.current = false
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    send({ type: 'text', text: draft }, draft.trim())
    setDraft('')
  }

  const reset = () => setState({ ...load(), session: newSession(), messages: [], phone: `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}` })
  const current = state.session.node

  return (
    <div className="wa-page">
      <header className="db-top">
        <div className="wrap db-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
            <span className="brand-text">
              <b>WhatsApp bot</b>
              <span>Registration + reminder flow</span>
            </span>
          </Link>
          <div className="db-top-meta">
            <span className="chip">Simulated number +91 {state.phone.slice(0, 5)} {state.phone.slice(5)}</span>
            <button className="linkish" onClick={reset}>
              New conversation
            </button>
            <Link href="/dashboard" className="linkish">
              Campaign console
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap wa-main">
        <div className="phone" aria-label="WhatsApp conversation with the AI60 bot">
          <div className="phone-notch" aria-hidden />
          <div className="wa-header">
            <span className="wa-avatar" aria-hidden>
              60
            </span>
            <div>
              <b>
                AI60 · NxtWave <span className="wa-verified" title="Verified business" aria-label="Verified business" />
              </b>
              <small>{typing ? 'typing…' : 'Business account'}</small>
            </div>
          </div>
          <div className="wa-chat" ref={scroller}>
            <span className="wa-day">Today</span>
            <p className="wa-sys">🔒 Messages are end-to-end encrypted. This is a demo using the real bot logic.</p>
            {state.messages.map((m) => (
              <Bubble key={m.id} m={m} session={state.session} workshopAt={campaign.workshopAt} onReply={(input, title) => send(input, title)} />
            ))}
            {typing && (
              <div className="wa-row in">
                <div className="wa-bubble in wa-typing" aria-label="typing">
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            )}
            {!state.messages.length && (
              <div className="wa-start">
                <p>Students reach this chat by scanning the QR on a hall ticket or poster, or tapping a wa.me link in a class group.</p>
                <button className="btn btn-sm" onClick={() => send({ type: 'text', text: 'Hi' }, 'Hi')}>
                  Say “Hi” 👋
                </button>
              </div>
            )}
          </div>
          <form className="wa-input" onSubmit={onSubmit}>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message" aria-label="Message" disabled={typing} />
            <button aria-label="Send" disabled={typing}>
              ➤
            </button>
          </form>
        </div>

        <div className="wa-side">
          <section className="db-card">
            <h3>Flow map</h3>
            <p className="db-muted">The conversation's current step is highlighted; visited steps are ticked.</p>
            <div className="flow-map">
              {(['entry', 'register', 'after', 'submit', 'support'] as const).map((lane) => (
                <div key={lane} className="flow-lane">
                  <span className="mono small-label">{{ entry: 'Entry', register: 'Register (5 questions)', after: 'After', submit: 'Submit project', support: 'Support' }[lane]}</span>
                  <ol>
                    {FLOW_MAP.filter((n) => n.lane === lane).map((n) => (
                      <li key={n.id} className={n.id === current ? 'now' : state.session.visited.includes(n.id) ? 'done' : ''}>
                        {n.label}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <section className="db-card">
            <h3>Scheduled messages</h3>
            <p className="db-muted">Sent automatically by a cron job. Outside WhatsApp's 24-hour window these must be pre-approved templates. Tap to fast-forward time.</p>
            <div className="sched">
              {(
                [
                  ['nudge', 'Day 3 · referral nudge'],
                  ['t24', 'T−24h · checklist'],
                  ['t1', 'T−1h · join link'],
                  ['post', 'T+2h · submit project'],
                ] as const
              ).map(([kind, labelText]) => (
                <button key={kind} className="mini-chip" disabled={typing || state.session.optedOut} onClick={() => botSay(state.session, scheduled(kind, state.session, deps, Math.max(0, SEAT_CAP - seats.length)), true)}>
                  ▶ {labelText}
                </button>
              ))}
            </div>
            {state.session.optedOut && <p className="db-muted">This number replied STOP, so scheduled messages are suppressed.</p>}
          </section>

          <section className="db-card">
            <h3>Why it's built this way</h3>
            <ul className="why-list">
              <li>
                <b>5 taps, not a form.</b> Lists and buttons instead of typing. College comes from a list so the leaderboard stays clean.
              </li>
              <li>
                <b>The ticket is the hook.</b> Registration ends with the hall-ticket image and a ready-to-forward invite for the batch.
              </li>
              <li>
                <b>Attendance is the real KPI.</b> T−24h checklist and T−1h join link; "Can't make it" gets the recording path.
              </li>
              <li>
                <b>Respectful by default.</b> STOP works at any point, and nothing is sent after it.
              </li>
              <li>
                <b>Same engine in production.</b> <code>/api/whatsapp</code> runs this exact flow against the WhatsApp Cloud API{mode === 'demo' ? ' once its keys are set' : ''}.
              </li>
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
