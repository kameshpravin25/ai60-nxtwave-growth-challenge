import { useState } from 'react'
import { SecHead } from './ui'

const QA = [
  {
    q: "I'm from MECH / CIVIL / ECE / EEE. Is this really for me?",
    a: 'Yes. That is why there are branch-specific projects. Most mass recruiters hire every branch into tech roles, and a core-branch student with a live AI project stands out more than another CSE student with a to-do app.',
  },
  {
    q: "I can't code much. Will I keep up?",
    a: "If you can copy, paste and read an error message, yes. You get starter code, every step is shown on screen, and mentors answer in the chat. The goal is understanding what you built, not typing speed.",
  },
  {
    q: "It's free. What's the catch?",
    a: "No catch, and no payment for anything in this workshop. NxtWave runs these so you can experience how it teaches. At the end there's a short, skippable note about NxtWave programmes. That's it.",
  },
  {
    q: 'Do I get a certificate just for attending?',
    a: 'No, and that is the point. Submit your live project URL within 48 hours and an automated evaluator checks that it is live, really uses AI and keeps your API key secret. Pass, and you get a certificate anyone can verify with one scan. That makes it worth putting on LinkedIn.',
  },
  {
    q: 'Will there be a recording?',
    a: 'Registered students get the recording for 48 hours, so you can finish building if your Wi-Fi dies. The live session is where you get unblocked, though.',
  },
  {
    q: 'Do I need a laptop?',
    a: 'For building, yes: any laptop with Chrome. A phone is enough to watch, and you can build later from the recording.',
  },
  {
    q: "I'm in pre-final year. Can I join?",
    a: "Yes. Final-years get priority if seats overflow, but a project before your final year is an even bigger head start.",
  },
]

export default function Viva() {
  const [open, setOpen] = useState<number>(0)
  return (
    <section className="section" id="viva">
      <div className="wrap narrow">
        <SecHead
          no="06"
          kicker="Viva voce"
          page={6}
          title={
            <>
              Viva questions. <span className="hl">We answer this time.</span>
            </>
          }
        />
        <div className="viva">
          {QA.map((item, i) => {
            const isOpen = open === i
            return (
              <div key={item.q} className={`viva-item${isOpen ? ' open' : ''}`}>
                <h3>
                  <button aria-expanded={isOpen} aria-controls={`viva-${i}`} id={`viva-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    <span className="mono viva-no">Q{i + 1}.</span>
                    <span>{item.q}</span>
                    <span className="viva-toggle" aria-hidden>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                </h3>
                <div id={`viva-${i}`} role="region" aria-labelledby={`viva-q-${i}`} className="viva-a" hidden={!isOpen}>
                  <p>
                    <span className="mono ans">Ans.</span> {item.a}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
