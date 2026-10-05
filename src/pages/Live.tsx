import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { useIdentity, useRoom, type Identity, type Room } from '../lib/live/useRoom'
import { transport } from '../lib/live/transport'
import { MILESTONES, REACTIONS, type Milestone } from '../lib/live/types'
import { leaderboard, questionRank } from '../lib/live/reducer'
import { AGENDA } from '../data/agenda'
import { BRANCHES } from '../data/branches'
import { starterCode } from '../data/starter'
import { copyText } from '../lib/share'
import { relative } from '../lib/time'
import { PollResults, QuizTimer, ReactionLayer, StepTrack, quizRemaining, useFresh } from '../components/live'

const STUCK_CHIPS = ['API key not valid', "ModuleNotFoundError: google.genai", 'Space stuck on Building', '429 RESOURCE_EXHAUSTED', 'App shows Error on submit']

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
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

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="mono">{title}</span>
        <CopyButton text={code} />
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  )
}

/* ---------------- Step content ---------------- */

function StepPanel({ r, me }: { r: Room; me: Identity }) {
  const { room } = r
  const project = BRANCHES.find((b) => b.branch === me.branch) ?? BRANCHES[0]
  const starter = starterCode(me.branch)
  const mine = room.attendees.get(me.who)
  const has = (m: Milestone) => Boolean(mine?.checks.has(m))
  const check = (m: Milestone) => !has(m) && r.post(me.who, { kind: 'check', milestone: m })
  const [url, setUrl] = useState('')
  const [urlError, setUrlError] = useState('')
  const shipped = room.shipped.find((s) => s.who === me.who)
  const post = `I built my first AI project today: ${project.project} 🚀\n\n${project.what}\n\nBuilt with the Gemini API + Gradio, deployed on Hugging Face${shipped ? `: ${shipped.url}` : '.'}\n\nThanks @NxtWave for #AI60. Next: making it better.`

  if (!room.started) {
    return (
      <section className="live-card step-card">
        <span className="mono small-label">Waiting room</span>
        <h2>Doors are open. The host starts in a moment.</h2>
        <p>Keep this tab open: the agenda, your starter code, polls and the quiz all appear here, live.</p>
      </section>
    )
  }

  const step = AGENDA[room.step]
  const ship = async (e: FormEvent) => {
    e.preventDefault()
    try {
      const u = new URL(url.trim())
      if (u.protocol !== 'https:') throw new Error()
    } catch {
      return setUrlError('Paste the full https:// link to your live app')
    }
    setUrlError('')
    await r.post(me.who, { kind: 'check', milestone: 'deploy' })
    await r.post(me.who, { kind: 'ship', url: url.trim(), project: project.project, name: me.name, college: me.college })
  }

  return (
    <section className="live-card step-card" aria-live="polite">
      <span className="mono small-label">
        Step {room.step + 1} of 5 · {step.at}–{step.end} min
      </span>
      <h2>{step.title}</h2>
      <p className="step-body">{step.body}</p>

      {room.step === 0 && (
        <ol className="do-list">
          <li>
            Get a free Gemini API key at{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
              aistudio.google.com/apikey
            </a>{' '}
            (sign in with Google, then "Create API key").
          </li>
          <li>
            Create a Hugging Face account at{' '}
            <a href="https://huggingface.co/join" target="_blank" rel="noreferrer">
              huggingface.co/join
            </a>
            . This is where your app will live.
          </li>
          <li>
            <button className={`btn btn-sm${has('key') ? ' btn-ghost' : ''}`} onClick={() => check('key')} disabled={has('key')}>
              {has('key') ? '✓ Key ready' : 'I have my API key'}
            </button>
          </li>
        </ol>
      )}

      {room.step === 1 && (
        <div className="concept">
          <div className="concept-box">
            <span className="mono">Input</span>
            <p>{starter.project === 'BillBot' ? 'A photo of your bill' : 'What the user pastes in'}</p>
          </div>
          <span className="concept-arrow" aria-hidden>
            →
          </span>
          <div className="concept-box ink">
            <span className="mono">System prompt + model</span>
            <p>The rules that make {project.project} behave like an expert, not a chatbot.</p>
          </div>
          <span className="concept-arrow" aria-hidden>
            →
          </span>
          <div className="concept-box">
            <span className="mono">Output</span>
            <p>Structured, checkable, useful. Shown in your app.</p>
          </div>
          <p className="concept-note">
            Interview line: <i>"The model doesn't know my problem. The system prompt and the input format do the heavy lifting."</i>
          </p>
        </div>
      )}

      {room.step === 2 && (
        <div className="build">
          <p>
            Your project: <b>{project.project}</b>. {project.what}
          </p>
          <ol className="do-list">
            <li>
              Open a new notebook at{' '}
              <a href="https://colab.research.google.com" target="_blank" rel="noreferrer">
                colab.research.google.com
              </a>{' '}
              and add your key under 🔑 Secrets as <code>GEMINI_API_KEY</code>.
            </li>
            <li>
              Run <code>!pip install -q gradio google-genai</code>, then the cell below to load the key.
            </li>
            <li>Paste <code>app.py</code> into the next cell and run it. Your app appears right inside Colab.</li>
          </ol>
          <CodeBlock title="Colab: load your key" code={`import os\nfrom google.colab import userdata\nos.environ["GEMINI_API_KEY"] = userdata.get("GEMINI_API_KEY")`} />
          <CodeBlock title={`app.py · ${starter.project}`} code={starter.app} />
          <div className="row-btns">
            <button className={`btn btn-sm${has('call') ? ' btn-ghost' : ''}`} onClick={() => check('call')} disabled={has('call')}>
              {has('call') ? '✓ AI responded' : 'Got my first AI response'}
            </button>
            <button className={`btn btn-sm${has('ui') ? ' btn-ghost' : ''}`} onClick={() => check('ui')} disabled={has('ui') || !has('call')}>
              {has('ui') ? '✓ UI works' : 'My app UI works'}
            </button>
          </div>
        </div>
      )}

      {room.step === 3 && (
        <div className="ship">
          <ol className="do-list">
            <li>
              <a href="https://huggingface.co/new-space" target="_blank" rel="noreferrer">
                huggingface.co/new-space
              </a>{' '}
              → name it <code>{project.project.toLowerCase()}</code> → SDK: <b>Gradio</b> → Create.
            </li>
            <li>
              Files → upload <code>app.py</code> and <code>requirements.txt</code>.
            </li>
            <li>
              Settings → Variables and secrets → New secret: <code>GEMINI_API_KEY</code>.
            </li>
            <li>Wait for "Running", then open it on your phone.</li>
          </ol>
          <CodeBlock title="requirements.txt" code={starter.requirements} />
          {shipped ? (
            <p className="shipped-note">
              🚀 You're live at{' '}
              <a href={shipped.url} target="_blank" rel="noreferrer">
                {shipped.url.replace(/^https:\/\//, '')}
              </a>
              . You're on the shipped wall.
            </p>
          ) : (
            <form className="ship-form" onSubmit={ship}>
              <label className="field">
                <span>Your live app URL</span>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`https://huggingface.co/spaces/you/${project.project.toLowerCase()}`} aria-invalid={!!urlError} />
                {urlError && <span className="field-error">{urlError}</span>}
              </label>
              <button className="btn">I'm live 🚀</button>
            </form>
          )}
        </div>
      )}

      {room.step === 4 && (
        <div className="package">
          <span className="mono small-label">Resume line</span>
          <p className="resume-line">• {project.bullet}</p>
          <span className="mono small-label">LinkedIn post</span>
          <pre className="post-draft">{post}</pre>
          <div className="row-btns">
            <CopyButton text={project.bullet} label="Copy resume line" />
            <CopyButton text={post} label="Copy post" />
            <Link className="btn btn-sm" href={`/submit${shipped ? `?url=${encodeURIComponent(shipped.url)}` : ''}`}>
              Get evaluated & certified →
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}

/* ---------------- Progress + stuck ---------------- */

function Progress({ r, me }: { r: Room; me: Identity }) {
  const { room, now } = r
  const mine = room.attendees.get(me.who)
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const queue = [...room.attendees.values()].filter((a) => a.stuck).sort((a, b) => a.stuck!.at - b.stuck!.at)
  const position = queue.findIndex((a) => a.who === me.who) + 1

  return (
    <section className="live-card">
      <h3>My progress</h3>
      <ul className="milestones">
        {MILESTONES.map((m) => {
          const at = mine?.checks.get(m.key)
          return (
            <li key={m.key} className={at ? 'done' : ''}>
              <span className="ms-dot" aria-hidden>
                {at ? '✓' : ''}
              </span>
              <span>{m.label}</span>
              {at && <time className="mono">{relative(at, now)}</time>}
            </li>
          )
        })}
      </ul>

      {mine?.stuck ? (
        <div className="stuck-box on">
          <p>
            🙋 <b>Mentor notified.</b> You're #{position} in the queue.
            <br />
            <small>"{mine.stuck.note}"</small>
          </p>
          <button className="btn btn-sm btn-ghost" onClick={() => r.post(me.who, { kind: 'unstuck' })}>
            Fixed it myself ✓
          </button>
        </div>
      ) : open ? (
        <form
          className="stuck-box"
          onSubmit={(e) => {
            e.preventDefault()
            r.post(me.who, { kind: 'stuck', step: Math.max(0, room.step), note: note.trim() || 'Need help' })
            setOpen(false)
            setNote('')
          }}
        >
          <label className="field">
            <span>What's the error? (paste it)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. API key not valid" autoFocus maxLength={160} />
          </label>
          <div className="chip-row">
            {STUCK_CHIPS.map((c) => (
              <button type="button" key={c} className="mini-chip" onClick={() => setNote(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="row-btns">
            <button className="btn btn-sm">Raise hand 🙋</button>
            <button type="button" className="linkish" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-ghost btn-block stuck-btn" onClick={() => setOpen(true)} disabled={!room.started}>
          I'm stuck 🙋 <small>{queue.length ? `${queue.length} in queue` : 'queue is empty'}</small>
        </button>
      )}
    </section>
  )
}

/* ---------------- Poll / quiz ---------------- */

function Interactive({ r, me }: { r: Room; me: Identity }) {
  const { room, now } = r
  const quiz = room.activeQuiz ? room.quizzes.get(room.activeQuiz) : undefined
  const quizLive = quiz && now - quiz.at < quiz.seconds * 1000 + 12000

  if (quiz && quizLive) {
    const left = quizRemaining(quiz, now)
    const mine = quiz.answers.get(me.who)
    const board = leaderboard(room, 5)
    const myRank = [...room.attendees.values()].sort((a, b) => b.points - a.points).findIndex((a) => a.who === me.who) + 1
    return (
      <section className="live-card quiz-card">
        <span className="mono small-label">Quiz · {quiz.answers.size} answered</span>
        <h3>{quiz.q}</h3>
        <QuizTimer quiz={quiz} now={now} />
        <div className="quiz-options">
          {quiz.options.map((o, i) => {
            const reveal = left === 0
            const cls = ['quiz-opt', mine?.option === i ? 'picked' : '', reveal && i === quiz.correct ? 'correct' : '', reveal && mine?.option === i && i !== quiz.correct ? 'wrong' : ''].join(' ')
            return (
              <button key={o} className={cls} disabled={Boolean(mine) || left === 0} onClick={() => r.post(me.who, { kind: 'answer', quiz: quiz.id, option: i })}>
                <span className="mono">{'ABCD'[i]}</span> {o}
              </button>
            )
          })}
        </div>
        {left === 0 ? (
          <div className="quiz-after">
            <p>{mine ? (mine.points ? `+${mine.points} points. Fast and right!` : 'Not this time. Next one!') : 'Time up!'}</p>
            <ol className="mini-board">
              {board.map((a) => (
                <li key={a.who} className={a.who === me.who ? 'is-me' : ''}>
                  <span>{a.who === me.who ? 'You' : a.name}</span>
                  <b className="mono">{a.points}</b>
                </li>
              ))}
            </ol>
            {myRank > 0 && (room.attendees.get(me.who)?.points ?? 0) > 0 && <p className="mono small-label">Your rank: #{myRank}</p>}
          </div>
        ) : (
          mine && <p className="locked">Locked in. Waiting for the timer…</p>
        )}
      </section>
    )
  }

  const poll = room.activePoll ? room.polls.get(room.activePoll) : [...room.polls.values()].sort((a, b) => b.at - a.at)[0]
  if (!poll) return null
  const mine = poll.votes.get(me.who)
  return (
    <section className="live-card poll-card">
      <span className="mono small-label">
        {poll.open ? 'Live poll' : 'Poll closed'} · {poll.votes.size} votes
      </span>
      <h3>{poll.q}</h3>
      {poll.open && mine === undefined ? (
        <div className="poll-options">
          {poll.options.map((o, i) => (
            <button key={o} className="poll-opt" onClick={() => r.post(me.who, { kind: 'vote', poll: poll.id, option: i })}>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <PollResults poll={poll} mine={mine} />
      )}
    </section>
  )
}

/* ---------------- Q&A ---------------- */

function QandA({ r, me }: { r: Room; me: Identity }) {
  const [text, setText] = useState('')
  const qs = [...r.room.questions.values()].filter((q) => !q.answered).sort((a, b) => questionRank(b) - questionRank(a) || a.at - b.at)
  const answered = [...r.room.questions.values()].filter((q) => q.answered).length
  return (
    <section className="live-card">
      <h3>Questions</h3>
      <form
        className="ask-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim().length < 5) return
          r.post(me.who, { kind: 'ask', qid: `q:${me.who}:${Date.now()}`, text: text.trim(), name: me.name, gold: me.gold })
          setText('')
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the mentors…" maxLength={200} aria-label="Ask a question" />
        <button className="btn btn-sm">Ask</button>
      </form>
      <ul className="qa-list">
        {qs.slice(0, 6).map((q) => {
          const voted = q.votes.has(me.who)
          return (
            <li key={q.qid}>
              <button
                className={`upvote${voted ? ' on' : ''}`}
                disabled={voted || q.who === me.who}
                onClick={() => r.post(me.who, { kind: 'upvote', qid: q.qid })}
                aria-label={`Upvote: ${q.text}`}
              >
                ▲<b>{q.votes.size}</b>
              </button>
              <div>
                <p>{q.text}</p>
                <small>
                  {q.who === me.who ? 'You' : q.name}
                  {q.gold && <span className="gold-pill">gold batch · priority</span>}
                </small>
              </div>
            </li>
          )
        })}
      </ul>
      {answered > 0 && <p className="mono small-label">{answered} answered live</p>}
    </section>
  )
}

/* ---------------- Shipped wall ---------------- */

function ShippedWall({ r, me }: { r: Room; me: Identity }) {
  const list = [...r.room.shipped].sort((a, b) => b.at - a.at)
  const fresh = useFresh(list.map((s) => s.who))
  return (
    <section className="live-card">
      <h3>
        Shipped wall <span className="count-pill">{list.length}</span>
      </h3>
      {list.length ? (
        <ul className="shipped-list">
          {list.slice(0, 7).map((s) => (
            <li key={s.who} className={fresh.has(s.who) ? 'fresh' : ''}>
              <span className="sh-rocket" aria-hidden>
                🚀
              </span>
              <div>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.project}
                </a>
                <small>
                  {s.who === me.who ? 'You' : s.name} · {s.college}
                </small>
              </div>
              {s.score !== undefined && <span className="mono score-chip">{s.score}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">The first live URL lands here. Will it be yours?</p>
      )}
    </section>
  )
}

/* ---------------- Page ---------------- */

function Gate({ onGuest }: { onGuest: (name: string) => void }) {
  const { me, mode, openRegister } = useApp()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [, force] = useState(0)

  if (mode === 'live' && me && !transport.hasToken()) {
    return (
      <form
        className="live-gate sheet"
        onSubmit={async (e) => {
          e.preventDefault()
          try {
            await transport.join(me.code, phone)
            force((x) => x + 1)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not join')
          }
        }}
      >
        <h1>Enter the workshop room</h1>
        <p>Confirm the WhatsApp number on hall ticket {me.code}.</p>
        <label className="field">
          <span>WhatsApp number</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="98765 43210" />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-block">Enter room →</button>
      </form>
    )
  }

  return (
    <div className="live-gate sheet">
      <span className="mono small-label">AI60 · Live workshop room</span>
      <h1>This is where the 60 minutes happen.</h1>
      <p>Agenda synced to the host, your branch's starter code, live polls, a quiz, Q&A and a wall of shipped projects.</p>
      <button className="btn btn-block" onClick={openRegister}>
        Get a hall ticket first →
      </button>
      {mode === 'demo' && (
        <form
          className="guest-form"
          onSubmit={(e) => {
            e.preventDefault()
            onGuest(name)
          }}
        >
          <p className="mono small-label">Or, for the demo</p>
          <div className="ask-form">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" />
            <button className="btn btn-sm btn-ghost">Join as guest</button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function Live() {
  const r = useRoom()
  const { room, now, session, mode } = r
  const [me, becomeGuest] = useIdentity()
  const joinedFor = useRef<string | null>(null)
  const inRoom = me && room.attendees.has(me.who)
  const canJoin = me && (mode === 'demo' || transport.hasToken())

  useEffect(() => {
    if (!me || !canJoin || inRoom) return
    const key = `${me.who}:${session?.start ?? 'live'}`
    if (joinedFor.current === key) return
    joinedFor.current = key
    r.post(me.who, { kind: 'join', name: me.name, college: me.college, branch: me.branch, gold: me.gold })
  })

  const deployed = [...room.attendees.values()].filter((a) => a.checks.has('deploy')).length

  return (
    <div className="live">
      <header className="live-top">
        <div className="wrap live-top-inner">
          <Link href="/" className="brand" aria-label="AI60 home">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
          </Link>
          <span className="live-dot">
            <i aria-hidden /> LIVE
          </span>
          <span className="live-title">Workshop room</span>
          <span className="live-stats mono">
            👥 {room.attendees.size} · 🚀 {deployed}
          </span>
          {mode === 'demo' && (
            <span className="live-demo">
              <span className="chip chip-warn">Simulated session{session?.mode === 'autopilot' ? ' · autopilot host' : ''}</span>
              <button className="linkish" onClick={r.restart}>
                Restart
              </button>
              <a className="linkish" href="/host" target="_blank" rel="noreferrer">
                Open host console ↗
              </a>
            </span>
          )}
        </div>
        <div className="wrap">
          <StepTrack room={room} now={now} />
        </div>
      </header>

      {!me || !canJoin ? (
        <main className="wrap live-main">
          <Gate onGuest={becomeGuest} />
        </main>
      ) : (
        <main className="wrap live-main">
          {room.announcement && (
            <p className="announce" role="status">
              <span className="mono">Host</span> {room.announcement.text}
            </p>
          )}
          <div className="live-grid">
            <div className="live-col">
              <StepPanel r={r} me={me} />
              <Progress r={r} me={me} />
            </div>
            <div className="live-col">
              <Interactive r={r} me={me} />
              <QandA r={r} me={me} />
              <ShippedWall r={r} me={me} />
            </div>
          </div>
          <div className="react-bar" role="group" aria-label="React">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => r.post(me.who, { kind: 'react', emoji: e })} aria-label={`React ${e}`}>
                {e}
              </button>
            ))}
          </div>
          <ReactionLayer room={room} now={now} />
        </main>
      )}
    </div>
  )
}
