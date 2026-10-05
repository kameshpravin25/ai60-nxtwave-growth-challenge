import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { ticketFor } from '../lib/myTicket'
import { formatDay, formatTime } from '../lib/time'
import { Arrow, Countdown, Scribble, SeatMeter, TicketImage } from './ui'
import type { TicketData } from '../lib/ticket'

export default function Hero() {
  const { seats, campaign, me, myName, refCounts, inviter, openRegister, loaded } = useApp()
  const nextSeat = seats.length + 1

  const ticket: TicketData = me
    ? ticketFor(me, myName, campaign.workshopAt, refCounts.get(me.code) ?? 0)
    : {
        name: 'Your Name Here',
        college: 'Your College',
        branch: 'Any branch',
        gradYear: 2027,
        seat: loaded ? nextSeat : null,
        code: 'AI60-????',
        workshopAt: campaign.workshopAt,
        link: window.location.origin,
        tier: 'standard',
        refCount: 0,
        specimen: true,
      }

  return (
    <section className="hero" id="top">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          {inviter && !me && (
            <p className="invite-banner">
              <span className="invite-seat mono">#{inviter.seat}</span>
              <span>
                <b>{inviter.name}</b> from {inviter.college} sent you this. Register and you join their batch.
              </span>
            </p>
          )}

          <ul className="chips" aria-label="Workshop facts">
            <li className="chip chip-ink">Free · Live · Online</li>
            <li className="chip">
              {formatDay(campaign.workshopAt)} · {formatTime(campaign.workshopAt)} IST
            </li>
            <li className="chip">Any branch</li>
          </ul>

          <p className="hero-expt mono">Experiment No. 1</p>
          <h1>
            Build your first <span className="hl">AI project</span> in 60&nbsp;minutes.
          </h1>
          <Scribble className="hero-scribble">the interviewer WILL ask about this ↓</Scribble>
          <p className="hero-sub">
            A free, live build-along for final-year engineers from <b>any branch</b>. You leave with a working AI app on a <b>live URL</b>, a certificate,
            and a real answer when they ask: <em>“So… have you built anything with AI?”</em>
          </p>

          <div className="hero-ctas">
            <button className="btn btn-lg" onClick={openRegister}>
              {me ? `View my hall ticket · Seat #${me.seat}` : 'Get my hall ticket'}
              <span aria-hidden>→</span>
            </button>
            <a className="btn btn-ghost btn-lg" href="#interview">
              What will I build?
            </a>
          </div>
          <p className="wa-alt">
            Prefer WhatsApp? <Link href="/whatsapp">Get your ticket in 5 taps →</Link>
          </p>

          <div className="hero-status">
            <SeatMeter taken={seats.length} />
            <div className="hero-countdown">
              <span className="mono small-label">Doors open in</span>
              <Countdown to={campaign.workshopAt} />
            </div>
          </div>

          <ul className="ticks">
            <li>Browser only. No installs, no GPU</li>
            <li>No AI background needed</li>
            <li>₹0. No card, ever</li>
          </ul>
        </div>

        <div className="hero-ticket">
          <div className="ticket-stage">
            <span className="tape tape-a" aria-hidden />
            <span className="tape tape-b" aria-hidden />
            <TicketImage data={ticket} alt={me ? `Your hall ticket, seat ${me.seat}` : 'Specimen hall ticket'} />
          </div>
          <div className="hero-ticket-note" aria-hidden>
            <Arrow className="flip" />
            <Scribble>{me ? 'yours. go flex it.' : `seat #${nextSeat} is up next.\ncould be yours.`}</Scribble>
          </div>
        </div>
      </div>
    </section>
  )
}
