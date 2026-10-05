import { useState } from 'react'
import { Link } from '../lib/router'
import { useRoom, type Room } from '../lib/live/useRoom'
import { funnel, leaderboard, questionRank } from '../lib/live/reducer'
import { ANNOUNCEMENTS, AUTOPILOT_SECONDS, POLL_TEMPLATES, QUIZ_TEMPLATES } from '../lib/live/sim'
import type { HostEvent } from '../lib/live/types'
import { AGENDA } from '../data/agenda'
import { relative } from '../lib/time'
import { PollResults, QuizTimer, ReactionLayer, StepTrack, quizRemaining } from '../components/live'

const KEY = 'ai60_host_key'

function useHostKey(): [string, (k: string) => void] {
  const [key, setKey] = useState(() => {
    try {
      return sessionStorage.getItem(KEY) ?? ''
    } catch {
      return ''
    }
  })
  return [
    key,
    (k) => {
      setKey(k)
      try {
        sessionStorage.setItem(KEY, k)
      } catch {
        /* ignore */
      }
    },
  ]
}

/** Completion funnel: where in the 60 minutes do people drop off? Single series, value at the tip. */
function Funnel({ r }: { r: Room }) {
  const f = funnel(r.room)
  const rows = [
    { label: 'In the room', n: f.joined },
    { label: 'Got API key', n: f.key },
    { label: 'First AI response', n: f.call },
    { label: 'UI working', n: f.ui },
    { label: 'Deployed live', n: f.deploy },
    { label: 'Submitted', n: f.submit },
  ]
  let worst = { from: '', to: '', drop: 0 }
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i - 1].n - rows[i].n
    if (rows[i].n > 0 && drop > worst.drop) worst = { from: rows[i - 1].label, to: rows[i].label, drop }
  }
  const max = Math.max(1, f.joined)
  return (
    <figure className="db-card host-funnel">
      <figcaption>
        <h3>Completion funnel</h3>
        <p>Where in the 60 minutes are people dropping? Mentors go where the drop is.</p>
      </figcaption>
      <ul className="barlist">
        {rows.map((row) => (
          <li key={row.label} tabIndex={0} title={`${row.label}: ${row.n} (${Math.round((row.n / max) * 100)}% of the room)`}>
            <span className="bl-label">{row.label}</span>
            <span className="bl-track">
              <span className="bl-bar" style={{ width: `${(row.n / max) * 100}%` }} />
              <span className="bl-val">
                {row.n} <small>{Math.round((row.n / max) * 100)}%</small>
              </span>
            </span>
          </li>
        ))}
      </ul>
      {worst.drop > 0 && (
        <p className="ins ins-warn funnel-note">
          <span className="ins-icon" aria-hidden>
            !
          </span>
          <span>
            <b>
              Biggest drop: {worst.from} → {worst.to} (−{worst.drop})
            </b>
            Send mentors to this step and pin the fix as an announcement.
          </span>
        </p>
      )}
    </figure>
  )
}

export default function Host() {
  const r = useRoom()
  const { room, now, session, mode } = r
  const [key, setKey] = useHostKey()
  const [custom, setCustom] = useState({ q: '', options: '' })
  const [announce, setAnnounce] = useState('')
  const [error, setError] = useState<string | null>(null)

  const send = async (e: HostEvent) => {
    setError(null)
    try {
      await r.host(e, key)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    }
  }

  const attendees = [...room.attendees.values()]
  const stuck = attendees.filter((a) => a.stuck).sort((a, b) => a.stuck!.at - b.stuck!.at)
  const blockers = new Map<string, number>()
  for (const s of room.stuckLog) blockers.set(s.note, (blockers.get(s.note) ?? 0) + 1)
  const topBlockers = [...blockers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  const byStep = AGENDA.map((_, i) => room.stuckLog.filter((s) => s.step === i).length)
  const questions = [...room.questions.values()].filter((q) => !q.answered).sort((a, b) => questionRank(b) - questionRank(a))
  const scored = room.shipped.filter((s) => s.score !== undefined)
  const avgScore = scored.length ? Math.round(scored.reduce((s, x) => s + (x.score ?? 0), 0) / scored.length) : 0
  const passed = scored.filter((s) => (s.score ?? 0) >= 60).length
  const poll = room.activePoll ? room.polls.get(room.activePoll) : undefined
  const quiz = room.activeQuiz ? room.quizzes.get(room.activeQuiz) : undefined
  const nextQuiz = QUIZ_TEMPLATES.find((t) => !room.quizzes.has(t.id))
  const autopilotLeft = session?.mode === 'autopilot' ? Math.max(0, session.start + AUTOPILOT_SECONDS * 1000 - now) : 0

  return (
    <div className="db host">
      <header className="db-top">
        <div className="wrap db-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
            <span className="brand-text">
              <b>Host console</b>
              <span>Live workshop control</span>
            </span>
          </Link>
          <div className="db-top-meta">
            {mode === 'demo' ? (
              <>
                <span className="chip chip-warn">
                  {session?.mode === 'autopilot' ? (autopilotLeft > 0 ? 'Autopilot running · press any control to take over' : 'Autopilot finished') : 'Manual control'}
                </span>
                <button className="linkish" onClick={r.restart}>
                  Restart session
                </button>
              </>
            ) : (
              <input className="key-input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Organiser key" aria-label="Organiser key" />
            )}
            <a className="linkish" href="/live" target="_blank" rel="noreferrer">
              Attendee view ↗
            </a>
            <Link href="/dashboard" className="linkish">
              Campaign console
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap db-main">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <section className="db-card host-steps">
          <StepTrack room={room} now={now} />
          <div className="row-btns">
            <button className="btn btn-ghost" disabled={room.step <= 0} onClick={() => send({ kind: 'step', step: room.step - 1 })}>
              ◀ Previous
            </button>
            <button className="btn" disabled={room.step >= AGENDA.length - 1} onClick={() => send({ kind: 'step', step: room.step + 1 })}>
              {room.started ? `Next: ${AGENDA[Math.min(room.step + 1, AGENDA.length - 1)].title} ▶` : 'Start session ▶'}
            </button>
          </div>
        </section>

        <section className="db-kpis host-kpis" aria-label="Room numbers">
          <div className="db-card db-hero">
            <span className="db-label">In the room</span>
            <span className="db-hero-num">{attendees.length}</span>
            <span className="db-sub">{attendees.filter((a) => a.gold).length} gold-batch students</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Deployed live</span>
            <span className="db-stat-num">{attendees.filter((a) => a.checks.has('deploy')).length}</span>
            <span className="db-sub">{attendees.length ? Math.round((attendees.filter((a) => a.checks.has('deploy')).length / attendees.length) * 100) : 0}% of the room</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Stuck right now</span>
            <span className="db-stat-num">{stuck.length}</span>
            <span className="db-sub">{room.stuckLog.length} hands raised in total</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Open questions</span>
            <span className="db-stat-num">{questions.length}</span>
            <span className="db-sub">sorted by votes + gold priority</span>
          </div>
          <div className="db-card db-stat">
            <span className="db-label">Avg evaluation score</span>
            <span className="db-stat-num">{scored.length ? avgScore : '—'}</span>
            <span className="db-sub">
              {passed}/{scored.length} certified (≥60)
            </span>
          </div>
        </section>

        <section className="db-row db-row-2">
          <Funnel r={r} />
          <div className="db-card">
            <h3>Stuck queue</h3>
            <p className="db-muted">Oldest first. Resolving notifies the student. Hands raised per step: {byStep.map((n, i) => `${i + 1}: ${n}`).join(' · ')}</p>
            {stuck.length ? (
              <ul className="stuck-queue">
                {stuck.slice(0, 8).map((a) => (
                  <li key={a.who}>
                    <div>
                      <b>{a.name}</b> <small className="db-muted">{a.college}</small>
                      <p>"{a.stuck!.note}"</p>
                      <small className="mono db-muted">
                        Step {a.stuck!.step + 1} · waiting {relative(a.stuck!.at, now).replace(' ago', '')}
                      </small>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => send({ kind: 'resolve', target: a.who })}>
                      Resolve ✓
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">Nobody is stuck. 🎉</p>
            )}
            {topBlockers.length > 0 && (
              <>
                <h4 className="mono small-label">Most common blockers</h4>
                <ul className="blockers">
                  {topBlockers.map(([note, n]) => (
                    <li key={note}>
                      <span>{note}</span>
                      <b className="mono">{n}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Broadcast to the room</h3>
            <p className="db-muted">Pin a fix for the most common blocker instead of answering it 40 times.</p>
            <form
              className="lb-out"
              onSubmit={(e) => {
                e.preventDefault()
                send({ kind: 'announce', text: announce.trim() })
                setAnnounce('')
              }}
            >
              <input value={announce} onChange={(e) => setAnnounce(e.target.value)} placeholder="Type an announcement…" aria-label="Announcement" />
              <button className="btn btn-sm">Pin</button>
            </form>
            <div className="chip-row">
              {ANNOUNCEMENTS.map((a) => (
                <button key={a} className="mini-chip" onClick={() => send({ kind: 'announce', text: a })}>
                  {a.slice(0, 46)}…
                </button>
              ))}
              {room.announcement && (
                <button className="mini-chip" onClick={() => send({ kind: 'announce', text: '' })}>
                  Clear pinned message
                </button>
              )}
            </div>
            {room.announcement && <p className="announce small">{room.announcement.text}</p>}
          </div>

          <div className="db-card">
            <h3>Polls</h3>
            {poll ? (
              <>
                <p className="poll-q">
                  <b>{poll.q}</b> <span className="db-muted">· {poll.votes.size} votes</span>
                </p>
                <PollResults poll={poll} />
                <button className="btn btn-sm btn-ghost" onClick={() => send({ kind: 'poll_close', poll: poll.id })}>
                  Close poll
                </button>
              </>
            ) : (
              <>
                <div className="chip-row">
                  {POLL_TEMPLATES.map((t) => (
                    <button key={t.id} className="mini-chip" onClick={() => send({ kind: 'poll', poll: `${t.id}-${Date.now().toString(36)}`, q: t.q, options: t.options })}>
                      {t.q}
                    </button>
                  ))}
                </div>
                <form
                  className="custom-poll"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const options = custom.options.split(',').map((o) => o.trim()).filter(Boolean).slice(0, 5)
                    if (!custom.q.trim() || options.length < 2) return setError('A poll needs a question and at least 2 comma-separated options')
                    send({ kind: 'poll', poll: `c-${Date.now().toString(36)}`, q: custom.q.trim(), options })
                    setCustom({ q: '', options: '' })
                  }}
                >
                  <input value={custom.q} onChange={(e) => setCustom({ ...custom, q: e.target.value })} placeholder="Custom question" aria-label="Poll question" />
                  <input value={custom.options} onChange={(e) => setCustom({ ...custom, options: e.target.value })} placeholder="Options, comma separated" aria-label="Poll options" />
                  <button className="btn btn-sm">Launch poll</button>
                </form>
              </>
            )}
          </div>
        </section>

        <section className="db-row db-row-2">
          <div className="db-card">
            <h3>Quiz</h3>
            {quiz && quizRemaining(quiz, now) > 0 ? (
              <>
                <p className="poll-q">
                  <b>{quiz.q}</b> <span className="db-muted">· {quiz.answers.size} answered</span>
                </p>
                <QuizTimer quiz={quiz} now={now} />
              </>
            ) : nextQuiz ? (
              <button className="btn btn-sm" onClick={() => send({ kind: 'quiz', quiz: nextQuiz.id, q: nextQuiz.q, options: nextQuiz.options, correct: nextQuiz.correct, seconds: nextQuiz.seconds })}>
                Launch: "{nextQuiz.q}"
              </button>
            ) : (
              <p className="db-muted">All {QUIZ_TEMPLATES.length} questions done.</p>
            )}
            <h4 className="mono small-label board-label">Leaderboard</h4>
            <ol className="mini-board">
              {leaderboard(room, 5).map((a) => (
                <li key={a.who}>
                  <span>
                    {a.name} <small className="db-muted">{a.college}</small>
                  </span>
                  <b className="mono">{a.points}</b>
                </li>
              ))}
            </ol>
          </div>

          <div className="db-card">
            <h3>Questions</h3>
            <p className="db-muted">Votes + 5 for gold-batch students (the referral perk).</p>
            {questions.length ? (
              <ul className="qa-list host-qa">
                {questions.slice(0, 6).map((q) => (
                  <li key={q.qid}>
                    <span className="upvote on">
                      ▲<b>{q.votes.size}</b>
                    </span>
                    <div>
                      <p>{q.text}</p>
                      <small>
                        {q.name}
                        {q.gold && <span className="gold-pill">gold batch</span>}
                      </small>
                    </div>
                    <button className="btn btn-sm btn-ghost" onClick={() => send({ kind: 'answered', qid: q.qid })}>
                      Answered
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No open questions.</p>
            )}
          </div>
        </section>

        <section className="db-card">
          <h3>Shipped wall ({room.shipped.length})</h3>
          <div className="table-scroll">
            <table className="db-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Project</th>
                  <th className="num">Score</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {[...room.shipped]
                  .sort((a, b) => b.at - a.at)
                  .slice(0, 10)
                  .map((s) => (
                    <tr key={s.who}>
                      <td>
                        <b>{s.name}</b>
                        <small className="db-muted block">{s.college}</small>
                      </td>
                      <td>
                        <a href={s.url} target="_blank" rel="noreferrer">
                          {s.project}
                        </a>
                      </td>
                      <td className="num">{s.score ?? '—'}</td>
                      <td className="mono nowrap">{relative(s.at, now)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <ReactionLayer room={room} now={now} />
    </div>
  )
}
