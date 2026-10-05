import { Link } from '../lib/router'
import { useApp } from '../lib/state'
import { BUILDER_NAME } from '../config'

const ASSETS = [
  {
    brief: 'Landing page',
    built: 'Lab-record themed page: interview simulator per branch, 60-minute procedure, live 500-seat chart, inter-college standings, viva FAQ.',
    links: [{ href: '/', label: 'Landing page' }],
  },
  {
    brief: 'Referral code and tracker',
    built: 'Every hall ticket carries an invite code + QR. Batch tiers (1 / 3 / 10), a live referrer leaderboard, Campus Captain tracked links with personal scoreboards and posters, and an organiser console with attribution and pacing.',
    links: [
      { href: '/dashboard', label: 'Organiser console' },
      { href: '/captain/VNR-SNEHA', label: 'A captain’s page' },
    ],
  },
  {
    brief: 'WhatsApp flow',
    built: 'Bot: registration in 5 taps (lists and buttons), hall ticket in chat, batch invite, T−24h / T−1h reminders, STOP opt-out, project submission with instant evaluation. Same engine powers a WhatsApp Cloud API webhook.',
    links: [{ href: '/whatsapp', label: 'Try the bot' }],
  },
  {
    brief: 'Engagement tools during the workshop',
    built: 'Live room synced to the host: per-branch starter code, milestone checklist, “I’m stuck” queue, polls, timed quiz with leaderboard, upvoted Q&A (gold-batch priority), reactions, shipped wall. Host console with the completion funnel.',
    links: [
      { href: '/live', label: 'Attendee room' },
      { href: '/host', label: 'Host console' },
    ],
  },
  {
    brief: 'Automation of AI project evaluation',
    built: 'Checks the URL is live, reads the Hugging Face Space’s source, scans for leaked API keys, grades a 5-part rubric with Claude (deterministic guardrails it can’t override), and issues a signed certificate with a public verify page and LinkedIn add-to-profile.',
    links: [{ href: '/submit', label: 'Evaluate a project' }],
  },
]

const PATH = [
  { t: 'Register', d: 'On the landing page, pick your branch in “The question”, then get a hall ticket. Copy your invite link, open it in a new tab and register a “friend”: your ticket upgrades live.', href: '/' },
  { t: 'Run the campaign', d: 'The organiser console shows pacing against the 7-day plan, attribution by channel, stalled captains and what to do today.', href: '/dashboard' },
  { t: 'Chat with the bot', d: 'Say Hi, register in 5 taps, then fire the scheduled reminders. The new seat appears on the console as “WhatsApp bot”.', href: '/whatsapp' },
  { t: 'Run the workshop', d: 'Open the host console and the attendee room side by side. Autopilot runs a session; take over, raise your hand, resolve it.', href: '/host' },
  { t: 'Certify a project', d: 'In the evaluator, choose “Try a sample project”, watch the pipeline, then open the certificate’s verify page.', href: '/submit' },
]

const LOOP = ['Captains, clubs & referrals', 'Register (page or bot)', 'WhatsApp reminders', 'Live workshop room', 'AI evaluation', 'Certificate on LinkedIn', 'Verify page → next cohort']

export default function Tour() {
  const { mode } = useApp()
  return (
    <div className="tour">
      <main className="wrap tour-main">
        <Link href="/" className="linkish">
          ← Back to the landing page
        </Link>
        <span className="mono small-label tour-kicker">Reviewer tour · NxtWave Growth Intern Challenge · {BUILDER_NAME}</span>
        <h1>
          The brief listed 5 kinds of asset. <span className="hl">This builds all 5,</span> wired into one funnel.
        </h1>
        <p className="lede">
          Goal: 500 final-year registrations in 7 days on ₹2,000. Each tool below owns one stage of that funnel, and they share one data model, so a WhatsApp sign-up shows up on the
          seat chart, the captain leaderboard and the console at once.
        </p>

        <div className="loop" aria-label="How the tools connect">
          {LOOP.map((s, i) => (
            <span key={s} className="loop-step">
              <span className="mono">{String(i + 1).padStart(2, '0')}</span>
              {s}
            </span>
          ))}
          <span className="loop-back" aria-hidden>
            ↺ verified certificates bring the next cohort
          </span>
        </div>

        <section className="tour-assets">
          {ASSETS.map((a, i) => (
            <article key={a.brief} className="sheet tour-asset">
              <span className="mono tour-n">0{i + 1}</span>
              <div>
                <span className="mono small-label">From the brief</span>
                <h2>{a.brief}</h2>
                <p>{a.built}</p>
              </div>
              <div className="tour-links">
                {a.links.map((l) => (
                  <Link key={l.href} className="btn btn-sm" href={l.href}>
                    {l.label} →
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="tour-path">
          <h2>A 3-minute walkthrough</h2>
          <ol>
            {PATH.map((p) => (
              <li key={p.t}>
                <Link href={p.href}>
                  <b>{p.t}</b>
                </Link>
                <span>{p.d}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="tour-meta sheet">
          <div>
            <h3>The strategy</h3>
            <p>
              Three channels, prioritised, with the funnel math and budget: <Link href="/plan">growth plan</Link> (prints to 2 pages).
            </p>
          </div>
          <div>
            <h3>Under the hood</h3>
            <p>
              React + TypeScript, Supabase Postgres (RLS-locked, RPC-only), Vercel functions, Claude (<code>claude-opus-5-5</code>) for grading, an event-sourced live room, canvas-rendered tickets,
              certificates and posters.
            </p>
          </div>
          <div>
            <h3>{mode === 'demo' ? 'Demo mode' : 'Live mode'}</h3>
            <p>
              {mode === 'demo'
                ? 'The campaign, attendees and captains are simulated and clearly labelled. What you do is stored in this browser. With Supabase keys, every tool runs on real data.'
                : 'Running on Supabase: registrations, the live room and the bot share one database.'}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
