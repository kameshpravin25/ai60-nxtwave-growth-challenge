import { TIERS } from '../config'
import { useApp } from '../lib/state'
import { referrerBoard, tierFor } from '../lib/analytics'
import { whatsappMessage, whatsappUrl } from '../lib/share'
import { SecHead, Scribble } from './ui'

const PRIZES = ['₹250', '₹150', '₹100']

export default function Batch() {
  const { seats, me, refCounts, openRegister, openTicket } = useApp()
  const mine = me ? (refCounts.get(me.code) ?? 0) : 0
  const { next } = tierFor(mine)
  const board = referrerBoard(seats, 5)
  const maxStep = TIERS[TIERS.length - 1].at
  const progress = Math.min(100, (mine / maxStep) * 100)

  return (
    <section className="section" id="batch">
      <div className="wrap">
        <SecHead
          no="05"
          kicker="Group experiment"
          page={5}
          title={
            <>
              Your project batch is already 4 people. <span className="hl">Bring them.</span>
            </>
          }
          lede="Your hall ticket's roll number is also your invite code. Every batchmate who registers with it upgrades your ticket, and you both get a better workshop."
        />

        <div className="batch-grid">
          <div className="sheet tiers-sheet">
            <div className="tier-track" aria-hidden>
              <div className="tier-fill" style={{ width: `${progress}%` }} />
              {TIERS.map((t) => (
                <span key={t.key} className={`tier-dot${mine >= t.at ? ' done' : ''}`} style={{ left: `${(t.at / maxStep) * 100}%` }}>
                  {t.at}
                </span>
              ))}
            </div>

            <ol className="tiers">
              <li className="tier done">
                <span className="mono tier-at">0</span>
                <div>
                  <h4>Hall ticket</h4>
                  <p>Your seat, your invite code, and a QR that brings friends to your batch.</p>
                </div>
              </li>
              {TIERS.map((t) => (
                <li key={t.key} className={`tier${mine >= t.at ? ' done' : ''}${next?.key === t.key ? ' next' : ''}`}>
                  <span className="mono tier-at">{t.at}</span>
                  <div>
                    <h4>
                      {t.name}
                      {t.key === 'batch' && <span className="gold-pill">gold ticket</span>}
                    </h4>
                    <p>{t.perk}</p>
                  </div>
                </li>
              ))}
            </ol>

            {me ? (
              <div className="batch-me">
                <p>
                  <b>{mine}</b> batchmate{mine === 1 ? '' : 's'} joined with <span className="mono">{me.code}</span>.{' '}
                  {next ? (
                    <>
                      <b>{next.at - mine}</b> more to unlock <b>{next.name}</b>.
                    </>
                  ) : (
                    'Every tier unlocked. Legend.'
                  )}
                </p>
                <div className="row-btns">
                  <a className="btn btn-wa" href={whatsappUrl(whatsappMessage(me))} target="_blank" rel="noreferrer">
                    Send to batch on WhatsApp
                  </a>
                  <button className="btn btn-ghost" onClick={openTicket}>
                    My ticket & link
                  </button>
                </div>
              </div>
            ) : (
              <div className="batch-me">
                <p>Register first to get your invite code. It takes 30 seconds.</p>
                <button className="btn" onClick={openRegister}>
                  Get my code →
                </button>
              </div>
            )}
          </div>

          <aside className="sheet board-sheet">
            <p className="mono small-label">Live · top referrers</p>
            <h3>Batch leaders</h3>
            {board.length ? (
              <ol className="ref-board">
                {board.map((r, i) => (
                  <li key={r.seat.code} className={r.seat.code === me?.code ? 'is-me' : ''}>
                    <span className="mono rank">{i + 1}</span>
                    <span className="rb-name">
                      <b>{r.seat.code === me?.code ? 'You' : r.seat.name}</b>
                      <small>{r.seat.college}</small>
                    </span>
                    <span className="mono rb-count">{r.count}</span>
                    {i < 3 && <span className="prize">{PRIZES[i]}</span>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty">No referrals yet. The first one tops the board.</p>
            )}
            <p className="board-foot">
              Top 3 at close win <b>₹250 / ₹150 / ₹100</b> vouchers. Only verified registrations count, so no fake numbers.
            </p>
            <Scribble className="board-scribble">your batch could be here →</Scribble>
          </aside>
        </div>
      </div>
    </section>
  )
}
