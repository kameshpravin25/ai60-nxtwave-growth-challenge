import { BUDGET, BUILDER_NAME, DAILY_TARGETS } from '../config'
import { Link } from '../lib/router'

const CHANNELS = [
  {
    n: '01',
    name: 'Campus Captains → class & placement WhatsApp groups',
    seats: 290,
    what: 'Recruit 15 class representatives, placement coordinators and club leads across ~10 colleges (from my own network, LinkedIn, college Instagram pages). Each gets a tracked link, a ready-to-paste WhatsApp kit and a live leaderboard.',
    why: 'Final-years don\'t act on ads. They act on what their CR forwards to the class group, which every student reads. One captain reaches 60–150 students for ₹0.',
    math: '15 captains × ~150 reach = 2,250 students → ~35% open the link → ~37% register ≈ 290',
  },
  {
    n: '02',
    name: 'Hall-ticket referral loop ("Bring your batch")',
    seats: 125,
    what: 'Every registrant gets a shareable hall ticket (PNG + QR) whose roll number is their invite code. 1 / 3 / 10 batchmates unlock Prompt Pack → Gold ticket + priority Q&A → 1:1 resume review.',
    why: 'Final-year project batches are already 3–4 people, so the unit of referral already exists. A hall ticket is a meme students recognise instantly, which makes it a WhatsApp-status screenshot, not an ad.',
    math: 'k ≈ 0.3 on ~420 non-referral seats ≈ 125',
  },
  {
    n: '03',
    name: 'Clubs & communities',
    seats: 100,
    what: 'GDG on Campus, IEEE student branches and coding clubs post once to their community, with a tracked club link and the branch-specific project creative (MECH / CIVIL / ECE). Plus organic LinkedIn posts by captains.',
    why: 'Clubs reach motivated students across years. Branch creatives pull in non-CSE students, the biggest untapped pool (most mass recruiters hire every branch).',
    math: '5 clubs × ~400 members → ~5% register ≈ 100 (+ ~30 organic)',
  },
]

const WEEK = [
  { d: 'Day 0', t: 'Prep', b: 'Ship the page + console. Shortlist 25 captain candidates; confirm 15.' },
  { d: 'Day 1', t: 'Launch', b: 'Captains post in class & placement groups (message 1: the interview question).' },
  { d: 'Day 2', t: 'Second wave', b: 'Captains in sections that haven\'t posted yet. Fix the weakest message using the console.' },
  { d: 'Day 3', t: 'Referral push', b: 'Nudge every registrant: "2 more for a Gold ticket". Clubs go live.' },
  { d: 'Day 4', t: 'Clubs + LinkedIn', b: 'GDG/IEEE posts, branch creatives, captain LinkedIn posts.' },
  { d: 'Day 5', t: 'Mid-review', b: 'Console decides: double down on the top 3 captains, swap stalled ones, spend the ₹300 reserve only if behind.' },
  { d: 'Day 6', t: 'Scarcity', b: '"Last N seats" + live college leaderboard screenshot in every group.' },
  { d: 'Day 7', t: 'Close & convert', b: 'Final call, then T−24h checklist and T−1h join link. Attendance is the real KPI.' },
]

export default function Plan() {
  const total = CHANNELS.reduce((s, c) => s + c.seats, 0) + 30
  return (
    <div className="plan">
      <div className="plan-bar no-print">
        <Link href="/" className="linkish">
          ← Landing page
        </Link>
        <Link href="/dashboard" className="linkish">
          Organiser console
        </Link>
        <button className="btn btn-sm" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <article className="plan-doc">
        <header className="plan-head">
          <p className="mono small-label">NxtWave Growth Intern Challenge · Growth plan · {BUILDER_NAME}</p>
          <h1>500 final-year engineers in 7 days, for ₹2,000.</h1>
          <p className="plan-lede">
            Workshop: <b>Build Your First AI Project in 60 Minutes</b> (free, online). Strategy in one line: <b>don't buy reach. Borrow trust.</b> Final-years
            already live in WhatsApp groups run by people they trust. Give those people a reason and a tracker, then give every registrant a ticket worth forwarding.
          </p>
        </header>

        <section className="plan-sec">
          <h2>
            <span className="mono">1</span> The student
          </h2>
          <div className="plan-cols">
            <div>
              <h3>Who exactly</h3>
              <p>
                Final-year B.Tech/B.E. students (class of 2027), <b>all branches</b>, mostly tier-2/3 private and state colleges in AP/Telangana first (NxtWave's home ground), in
                the middle of placement season (Aug–Dec). Has a laptop, uses ChatGPT, has <b>never built anything with AI</b>.
              </p>
            </div>
            <div>
              <h3>Why they'd care</h3>
              <p>
                Interviewers now ask <i>"Have you built anything with AI?"</i> and most have no answer. Non-CSE students feel AI "isn't for them" while mass recruiters hire
                them into tech roles anyway. Courses feel long and costly. Placements are <b>this semester</b>.
              </p>
            </div>
            <div>
              <h3>What makes them register</h3>
              <p>
                A concrete, fast outcome: a <b>live URL</b>, a resume line and an interview answer in 60 minutes. A project for <b>their branch</b>. Free, browser-only. A
                certificate that means something (issued only on a shipped URL). And their batchmates going too.
              </p>
            </div>
          </div>
        </section>

        <section className="plan-sec">
          <h2>
            <span className="mono">2</span> Three channels, prioritised
          </h2>
          <div className="plan-channels">
            {CHANNELS.map((c) => (
              <div key={c.n} className="plan-channel">
                <div className="pc-head">
                  <span className="mono">{c.n}</span>
                  <h3>{c.name}</h3>
                  <span className="pc-seats">~{c.seats} seats</span>
                </div>
                <p>
                  <b>Do:</b> {c.what}
                </p>
                <p>
                  <b>Why it works:</b> {c.why}
                </p>
                <p className="mono pc-math">{c.math}</p>
              </div>
            ))}
          </div>
          <p className="plan-total">
            Planned: <b>~{total}</b> (incl. ~30 organic) against a goal of <b>500</b>, a ~9% buffer for the channel that underperforms. What I deliberately <i>didn't</i> do: paid ads
            (₹2,000 buys ~300 clicks, which is reach, not trust), cold email (low open rates with students) and 20 tactics at once.
          </p>
        </section>

        <section className="plan-sec plan-split">
          <div>
            <h2>
              <span className="mono">3</span> How the 500 come in
            </h2>
            <table className="plan-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Focus</th>
                  <th className="num">Cumulative target</th>
                </tr>
              </thead>
              <tbody>
                {WEEK.slice(1).map((w, i) => (
                  <tr key={w.d}>
                    <td className="mono">{w.d}</td>
                    <td>
                      <b>{w.t}.</b> {w.b}
                    </td>
                    <td className="num mono">{DAILY_TARGETS[i]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="plan-note">{WEEK[0].b}</p>
          </div>
          <div>
            <h2>
              <span className="mono">4</span> ₹2,000, spent on results
            </h2>
            <ul className="plan-budget">
              {BUDGET.map((b) => (
                <li key={b.item}>
                  <span className="mono">₹{b.amount.toLocaleString('en-IN')}</span>
                  <div>
                    <b>{b.item}</b>
                    <p>{b.note}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="plan-note">
              ≈ <b>₹4 per registration</b>. Tools cost ₹0: Vercel, Supabase, Gemini and Canva free tiers.
            </p>

            <h2>
              <span className="mono">5</span> Measure & de-risk
            </h2>
            <ul className="plan-list">
              <li>
                <b>Every seat is attributed</b> (captain / club / referral / post) via tracked links. The organiser console shows pacing vs this plan, hourly.
              </li>
              <li>
                <b>Risk: captains go quiet.</b> Recruit 15, need ~10. The console flags anyone with 0 seats in 24h.
              </li>
              <li>
                <b>Risk: registrations ≠ attendance.</b> Calendar invite at signup, T−24h checklist, T−1h link. Target 40%+ show-up.
              </li>
              <li>
                <b>Risk: fake referrals.</b> Unique phone + email per seat. Prizes only on verified, attended seats.
              </li>
            </ul>
          </div>
        </section>

        <section className="plan-sec">
          <h2>
            <span className="mono">6</span> What I built, and why this asset
          </h2>
          <p>
            Not one asset but the system behind the whole funnel, covering all five asset types in the brief and sharing one database. <b>Landing page</b> (interview hook, a
            project per branch, live seat map) and <b>referral tracker</b> (hall ticket = invite code, batch tiers, captain scoreboards and posters). A <b>WhatsApp bot</b> for
            registering in 5 taps plus T−24h/T−1h reminders. A <b>live workshop room</b> with a host console (stuck queue, polls, quiz, completion funnel). An <b>AI project
            evaluator</b> that checks the live URL, reads the source, scans for leaked keys, grades with Claude and issues a signed, verifiable certificate. Verified
            certificates on LinkedIn link back to the verify page, which brings the next cohort. React + Supabase (RLS-locked RPCs) on Vercel.
          </p>
        </section>
      </article>
    </div>
  )
}
