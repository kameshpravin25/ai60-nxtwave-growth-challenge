import { useState } from 'react'
import { useApp } from '../lib/state'
import { SecHead, Scribble } from './ui'
import { AGENDA as STEPS } from '../data/agenda'

const APPARATUS = [
  { ok: true, t: 'A laptop (any)' },
  { ok: true, t: 'Chrome' },
  { ok: true, t: 'A Google account' },
  { ok: true, t: '60 focused minutes' },
  { ok: false, t: 'A GPU' },
  { ok: false, t: 'Prior AI knowledge' },
  { ok: false, t: 'Installing anything' },
  { ok: false, t: 'Money' },
]

const OUTPUTS = [
  { k: 'Live project URL', v: 'A working app you can open in the interview, on your phone.' },
  { k: 'Certificate', v: 'Issued for a shipped project, not for attendance. Recruiters can tell the difference.' },
  { k: 'Resume bullet + LinkedIn post', v: 'Written together in the last 10 minutes, ready to paste.' },
  { k: '30-second answer', v: 'For "Tell me about a project you built with AI." Practised once, out loud.' },
]

export default function LabRecord() {
  const [active, setActive] = useState(2)
  const { openRegister } = useApp()
  const step = STEPS[active]

  return (
    <section className="section" id="lab">
      <div className="wrap">
        <SecHead
          no="03"
          kicker="Lab record"
          page={3}
          title={
            <>
              The only lab record you'll <span className="hl">enjoy writing.</span>
            </>
          }
          lede="Same format you've written a hundred times. Except this time, the experiment works and the result is yours to keep."
        />

        <div className="record sheet">
          <div className="binder" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>

          <div className="record-row">
            <h3 className="record-key">Aim</h3>
            <p className="record-aim">To build and deploy a working AI application in 60 minutes, starting from zero.</p>
          </div>

          <div className="record-row">
            <h3 className="record-key">Apparatus required</h3>
            <ul className="apparatus">
              {APPARATUS.map((a) => (
                <li key={a.t} className={a.ok ? 'ok' : 'no'}>
                  <span aria-hidden>{a.ok ? '✓' : '✗'}</span>
                  {a.ok ? a.t : <s>{a.t}</s>}
                  {!a.ok && <span className="sr-only"> (not required)</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="record-row">
            <h3 className="record-key">Procedure</h3>
            <div className="procedure">
              <div className="timeline" role="tablist" aria-label="Workshop minute by minute">
                {STEPS.map((s, i) => (
                  <button
                    key={s.title}
                    role="tab"
                    aria-selected={i === active}
                    className={`tl-seg${i === active ? ' active' : ''}`}
                    style={{ flexGrow: s.end - s.at }}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="mono tl-time">{String(s.at).padStart(2, '0')}:00</span>
                    <span className="tl-title">{s.title}</span>
                  </button>
                ))}
                <span className="mono tl-end" aria-hidden>
                  60:00
                </span>
              </div>
              <div className="tl-detail" role="tabpanel">
                <span className="mono">
                  Step {active + 1} · {String(step.at).padStart(2, '0')}:00 to {step.end}:00 · {step.end - step.at} min
                </span>
                <p>
                  <b>{step.title}.</b> {step.body}
                </p>
              </div>
            </div>
          </div>

          <div className="record-row">
            <h3 className="record-key">Result</h3>
            <div className="result">
              <p>
                The AI project was successfully built and deployed. <span className="hl">Live URL obtained.</span>
              </p>
              <Scribble className="grade">10/10 ✓ Excellent</Scribble>
            </div>
          </div>

          <div className="record-row">
            <h3 className="record-key">Precautions</h3>
            <ol className="precautions">
              <li>Don't watch passively. Build along, line by line.</li>
              <li>Keep your API key secret, like your exam roll number before results.</li>
              <li>Bring your project batch. Debugging is faster in fours.</li>
            </ol>
          </div>
        </div>

        <div className="outputs">
          {OUTPUTS.map((o, i) => (
            <div key={o.k} className="output">
              <span className="mono output-no">0{i + 1}</span>
              <h4>{o.k}</h4>
              <p>{o.v}</p>
            </div>
          ))}
        </div>
        <div className="center-cta">
          <button className="btn btn-lg" onClick={openRegister}>
            Book my lab slot →
          </button>
        </div>
      </div>
    </section>
  )
}
