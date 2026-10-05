import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Branch } from '../types'
import { TIERS } from '../config'
import { COLLEGES, canonicalCollege } from '../data/colleges'
import { useApp } from '../lib/state'
import { tierFor } from '../lib/analytics'
import { shareLink } from '../lib/attribution'
import { ticketFor } from '../lib/myTicket'
import { renderTicket, STAMP_POS, toBlob } from '../lib/ticket'
import { copyText, downloadBlob, downloadIcs, googleCalendarUrl, linkedinUrl, whatsappMessage, whatsappUrl } from '../lib/share'
import { formatDay, formatTime } from '../lib/time'
import { TicketImage } from './ui'
import { Link } from '../lib/router'

const BRANCH_OPTS: Array<{ v: Branch; l: string }> = [
  { v: 'CSE', l: 'CSE' },
  { v: 'IT', l: 'IT' },
  { v: 'ECE', l: 'ECE' },
  { v: 'EEE', l: 'EEE' },
  { v: 'MECH', l: 'MECH' },
  { v: 'CIVIL', l: 'CIVIL' },
  { v: 'OTHER', l: 'Other' },
]
const YEARS = [
  { v: 2027, l: '2027 · final year' },
  { v: 2028, l: '2028 · pre-final' },
  { v: 2026, l: '2026 · just graduated' },
]

function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Mount-only: the app state polls every few seconds, and re-running this would steal focus mid-typing.
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    document.body.classList.add('modal-open')
    ref.current?.querySelector<HTMLElement>('input, button:not(.modal-close), a')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([tabindex="-1"]), select, textarea')]
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.classList.remove('modal-open')
      document.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {children}
      </div>
    </div>
  )
}

function RegisterForm() {
  const { register, recover, inviter, campaign } = useApp()
  const [mode, setMode] = useState<'apply' | 'recover'>('apply')
  const [f, setF] = useState({ name: '', phone: '', email: '', college: '', branch: '' as Branch | '', gradYear: 2027, website: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    setF((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }))
  }

  const validate = (recovering: boolean) => {
    const e: Record<string, string> = {}
    const phone = f.phone.replace(/\D/g, '')
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter your 10-digit WhatsApp number'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) e.email = 'Enter a valid email'
    if (!recovering) {
      if (f.name.trim().length < 2) e.name = 'Enter your name'
      if (f.college.trim().length < 2) e.college = 'Enter your college'
      if (!f.branch) e.branch = 'Pick your branch'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    setServerError(null)
    if (f.website) return // honeypot: bots fill every field
    if (!validate(mode === 'recover')) return
    setBusy(true)
    try {
      if (mode === 'recover') {
        const found = await recover(f.phone, f.email)
        if (!found) setServerError('No hall ticket matches that number and email.')
      } else {
        await register({
          name: f.name.trim().replace(/\s+/g, ' '),
          phone: f.phone.replace(/\D/g, ''),
          email: f.email.trim(),
          college: canonicalCollege(f.college),
          branch: f.branch as Branch,
          gradYear: f.gradYear,
        })
      }
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const err = (k: string) =>
    errors[k] ? (
      <span className="field-error" id={`err-${k}`}>
        {errors[k]}
      </span>
    ) : null

  return (
    <form className="apply" onSubmit={submit} noValidate>
      <div className="apply-head">
        <span className="mono small-label">Form AI60-A · {mode === 'apply' ? 'Application for hall ticket' : 'Duplicate hall ticket'}</span>
        <h2>{mode === 'apply' ? 'Claim your seat.' : 'Find my hall ticket.'}</h2>
        <p className="apply-sub">
          {formatDay(campaign.workshopAt)} · {formatTime(campaign.workshopAt)} IST · 60 min · free
        </p>
        {inviter && mode === 'apply' && (
          <p className="apply-invite">
            ✓ Joining <b>{inviter.name}</b>'s batch ({inviter.college})
          </p>
        )}
      </div>

      {mode === 'apply' && (
        <label className="field">
          <span>Full name (as you want it on the ticket)</span>
          <input autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Ananya Reddy" aria-invalid={!!errors.name} aria-describedby="err-name" />
          {err('name')}
        </label>
      )}

      <label className="field">
        <span>WhatsApp number</span>
        <div className="phone-input">
          <span className="mono">+91</span>
          <input
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={11}
            value={f.phone}
            onChange={(e) => set('phone', e.target.value.replace(/[^\d ]/g, ''))}
            placeholder="98765 43210"
            aria-invalid={!!errors.phone}
            aria-describedby="err-phone"
          />
        </div>
        {err('phone')}
      </label>

      <label className="field">
        <span>Email</span>
        <input type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="you@college.edu" aria-invalid={!!errors.email} aria-describedby="err-email" />
        {err('email')}
      </label>

      {mode === 'apply' && (
        <>
          <label className="field">
            <span>College</span>
            <input list="college-list" value={f.college} onChange={(e) => set('college', e.target.value)} placeholder="Start typing… e.g. CBIT" aria-invalid={!!errors.college} aria-describedby="err-college" />
            <datalist id="college-list">
              {COLLEGES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {err('college')}
          </label>

          <fieldset className="field">
            <legend>Branch</legend>
            <div className="choice-row">
              {BRANCH_OPTS.map((b) => (
                <label key={b.v} className={`choice${f.branch === b.v ? ' on' : ''}`}>
                  <input type="radio" name="branch" value={b.v} checked={f.branch === b.v} onChange={() => set('branch', b.v)} />
                  {b.l}
                </label>
              ))}
            </div>
            {err('branch')}
          </fieldset>

          <fieldset className="field">
            <legend>Graduating in</legend>
            <div className="choice-row">
              {YEARS.map((y) => (
                <label key={y.v} className={`choice${f.gradYear === y.v ? ' on' : ''}`}>
                  <input type="radio" name="year" value={y.v} checked={f.gradYear === y.v} onChange={() => set('gradYear', y.v)} />
                  {y.l}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <input className="hp" tabIndex={-1} autoComplete="off" aria-hidden name="website" value={f.website} onChange={(e) => set('website', e.target.value)} />

      {serverError && (
        <p className="form-error" role="alert">
          {serverError}
        </p>
      )}

      <button className="btn btn-lg btn-block" disabled={busy}>
        {busy ? 'Stamping…' : mode === 'apply' ? 'Stamp my hall ticket →' : 'Find my ticket →'}
      </button>
      <p className="apply-fine">
        {mode === 'apply' ? (
          <>
            We send the joining link and 2 reminders on WhatsApp. No spam, no calls.{' '}
            <button type="button" className="linkish" onClick={() => setMode('recover')}>
              Already registered?
            </button>
          </>
        ) : (
          <button type="button" className="linkish" onClick={() => setMode('apply')}>
            ← Back to registration
          </button>
        )}
      </p>
    </form>
  )
}

function TicketView() {
  const { me, myName, campaign, refCounts, justRegistered, mode } = useApp()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!me) return <p className="apply">Loading your ticket…</p>

  const count = refCounts.get(me.code) ?? 0
  const { next } = tierFor(count)
  const data = ticketFor(me, myName, campaign.workshopAt, count, !justRegistered)
  const link = shareLink(me.code)
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  const ticketFile = async () => {
    const blob = await toBlob(await renderTicket({ ...data, stamp: true }))
    return new File([blob], `AI60-hall-ticket-seat-${me.seat}.png`, { type: 'image/png' })
  }

  const download = async () => {
    setBusy(true)
    try {
      const file = await ticketFile()
      downloadBlob(file, file.name)
    } finally {
      setBusy(false)
    }
  }

  const nativeShare = async () => {
    const file = await ticketFile()
    const payload: ShareData = { text: whatsappMessage(me), files: [file] }
    try {
      if (navigator.canShare?.(payload)) await navigator.share(payload)
      else await navigator.share({ text: whatsappMessage(me), url: link })
    } catch {
      /* user cancelled */
    }
  }

  return (
    <div className="ticket-view">
      <div className="tv-ticket">
        <div className="tv-ticket-inner">
          <TicketImage data={data} alt={`Hall ticket for seat ${me.seat}`} />
          {justRegistered && (
            <span className="stamp-overlay" style={{ left: `${STAMP_POS.x * 100}%`, top: `${STAMP_POS.y * 100}%`, width: `${STAMP_POS.r * 200}%` }} aria-hidden>
              <span>ALLOTTED</span>
            </span>
          )}
        </div>
      </div>

      <div className="tv-side">
        <span className="mono small-label">{justRegistered ? 'Hall ticket issued' : 'Your hall ticket'}</span>
        <h2>
          Seat <span className="seat-no">#{me.seat}</span> {me.seat > 500 ? 'is on the waitlist.' : 'is yours.'}
        </h2>
        <p className="tv-sub">
          {justRegistered ? 'You are in. ' : ''}Now make it a batch: everyone who registers with <span className="mono code">{me.code}</span> upgrades your ticket.
        </p>

        <div className="tv-actions">
          <a className="btn btn-wa btn-block" href={whatsappUrl(whatsappMessage(me))} target="_blank" rel="noreferrer">
            Send to my batch on WhatsApp
          </a>
          <div className="row-btns">
            <button className="btn btn-ghost" onClick={download} disabled={busy}>
              {busy ? 'Rendering…' : 'Download ticket'}
            </button>
            {canNativeShare && (
              <button className="btn btn-ghost" onClick={nativeShare}>
                Share to story…
              </button>
            )}
            <a className="btn btn-ghost" href={linkedinUrl(link)} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </div>
        </div>

        <div className="invite-link">
          <span className="mono">{link.replace(/^https?:\/\//, '')}</span>
          <button
            className="btn btn-sm"
            onClick={async () => {
              setCopied(await copyText(link))
              window.setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>

        <div className="tv-progress">
          <div className="tv-progress-head">
            <span>
              <b>{count}</b> batchmate{count === 1 ? '' : 's'} joined
            </span>
            <span className="mono">{next ? `${next.at - count} more → ${next.name}` : 'All tiers unlocked'}</span>
          </div>
          <div className="tv-bar">
            {TIERS.map((t) => (
              <span key={t.key} className={count >= t.at ? 'on' : ''} title={`${t.at}: ${t.name}`}>
                {t.at}
              </span>
            ))}
          </div>
          {mode === 'demo' && (
            <p className="demo-tip">
              <b>Try the loop:</b> open your invite link in a new tab and register a "friend". This ticket upgrades live.
            </p>
          )}
        </div>

        <div className="tv-cal">
          <span className="mono small-label">On workshop day</span>
          <p className="tv-day">
            Your <Link href="/live">workshop room</Link> opens here, with your branch's starter code, live polls and a stuck button. Afterwards, the{' '}
            <Link href="/submit">evaluator</Link> checks your project and issues the certificate.
          </p>
          <span className="mono small-label">Don't miss it</span>
          <div className="row-btns">
            <a className="btn btn-ghost btn-sm" href={googleCalendarUrl(campaign.workshopAt)} target="_blank" rel="noreferrer">
              + Google Calendar
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs(campaign.workshopAt)}>
              + Apple / Outlook (.ics)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RegisterModal() {
  const { modal, closeModal } = useApp()
  if (!modal) return null
  return (
    <Modal key={modal} onClose={closeModal} label={modal === 'register' ? 'Register for AI60' : 'Your hall ticket'}>
      {modal === 'register' ? <RegisterForm /> : <TicketView />}
    </Modal>
  )
}
