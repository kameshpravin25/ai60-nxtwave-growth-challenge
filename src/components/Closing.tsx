import { BUILDER_NAME } from '../config'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { formatLongDay, formatTime } from '../lib/time'
import { Countdown, Scribble, SeatMeter } from './ui'

export function FinalCta() {
  const { seats, campaign, me, openRegister } = useApp()
  return (
    <section className="section final" aria-labelledby="final-title">
      <div className="wrap">
        <div className="final-card">
          <div className="final-stamp" aria-hidden>
            <span>LAST</span>
            <b>CALL</b>
          </div>
          <p className="mono small-label">
            {formatLongDay(campaign.workshopAt)} · {formatTime(campaign.workshopAt)} IST · 60 min · Online
          </p>
          <h2 id="final-title">Hall tickets close at 500.</h2>
          <Scribble className="final-scribble">don't be seat #501.</Scribble>
          <div className="final-row">
            <SeatMeter taken={seats.length} />
            <div className="final-cd">
              <span className="mono small-label">Doors open in</span>
              <Countdown to={campaign.workshopAt} />
            </div>
          </div>
          <button className="btn btn-lg" onClick={openRegister}>
            {me ? `Share my ticket · Seat #${me.seat}` : 'Get my hall ticket'} <span aria-hidden>→</span>
          </button>
        </div>
      </div>
    </section>
  )
}

export function Footer() {
  const { mode } = useApp()
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div>
          <p className="brand-text">
            <b>AI60</b> <span>· Build Your First AI Project in 60 Minutes</span>
          </p>
          <p className="footer-fine">
            Concept and build by <b>{BUILDER_NAME}</b> for the NxtWave Growth Intern Challenge. A simulation, not an official NxtWave page.
            {mode === 'demo' && ' Running in demo mode: registrations are simulated and stored only in your browser.'}
          </p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/live">Workshop room</Link>
          <Link href="/submit">Project evaluator</Link>
          <Link href="/whatsapp">WhatsApp bot</Link>
          <Link href="/dashboard">Organiser console</Link>
          <Link href="/plan">Growth plan</Link>
          <Link href="/tour">Reviewer tour</Link>
        </nav>
      </div>
    </footer>
  )
}
