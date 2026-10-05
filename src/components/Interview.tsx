import { useState } from 'react'
import { BRANCHES } from '../data/branches'
import { useApp } from '../lib/state'
import { SecHead } from './ui'

export default function Interview() {
  const { openRegister } = useApp()
  const [idx, setIdx] = useState(0)
  const b = BRANCHES[idx]

  return (
    <section className="section" id="interview">
      <div className="wrap">
        <SecHead
          no="02"
          kicker="The question"
          page={2}
          title={
            <>
              Placement season has a <span className="hl">new question.</span>
            </>
          }
          lede="Service companies, startups and core firms now ask freshers about AI, and not only CSE freshers. Pick your branch and watch the same interview go two ways."
        />

        <div className="branch-picker" role="tablist" aria-label="Choose your branch">
          {BRANCHES.map((br, i) => (
            <button key={br.branch} role="tab" aria-selected={i === idx} className={`branch-chip${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)}>
              {br.label}
            </button>
          ))}
        </div>

        <div className="interview-grid" role="tabpanel" key={b.branch}>
          <article className="transcript before">
            <header>
              <span className="mono">Interview · You, today</span>
            </header>
            <p className="bubble q">
              <span className="who">Interviewer</span>
              Your resume says {b.branch === 'OTHER' ? 'engineering' : b.label}. Have you built anything with AI?
            </p>
            <p className="bubble a">
              <span className="who">You</span>
              <s>{b.before}</s>
            </p>
            <span className="margin-mark red" aria-hidden>
              Vague. −5
            </span>
          </article>

          <article className="transcript after">
            <header>
              <span className="mono">Interview · You, after the workshop</span>
            </header>
            <p className="bubble q">
              <span className="who">Interviewer</span>
              Have you built anything with AI?
            </p>
            <p className="bubble a">
              <span className="who">You</span>
              {b.after}
            </p>
            <span className="margin-mark green" aria-hidden>
              ✓ {b.note}
            </span>
          </article>
        </div>

        <div className="project-card">
          <div className="project-main">
            <span className="mono small-label">What you'll build ({b.label})</span>
            <h3>{b.project}</h3>
            <p>{b.what}</p>
            <ul className="skill-tags">
              {b.skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="project-resume">
            <span className="mono small-label">Your new resume line</span>
            <p className="resume-line">• {b.bullet}</p>
            <div className="project-actions">
              <button className="btn btn-sm" onClick={openRegister}>
                Earn this line →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
