import { useEffect, useState } from 'react'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { pad } from '../lib/time'

const SECTIONS = [
  { id: 'top', label: 'Kickoff' },
  { id: 'interview', label: 'The question' },
  { id: 'lab', label: 'Lab record' },
  { id: 'seats', label: 'Seating' },
  { id: 'batch', label: 'Batch' },
  { id: 'viva', label: 'Viva' },
]

/** The page is the workshop: scrolling top → bottom runs the clock from 00:00 to 60:00. */
function useScrollClock() {
  const [state, setState] = useState({ frac: 0, label: SECTIONS[0].label })
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const frac = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      let label = SECTIONS[0].label
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top < window.innerHeight * 0.4) label = s.label
      }
      setState({ frac, label })
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return state
}

export default function Nav() {
  const { me, openRegister } = useApp()
  const { frac, label } = useScrollClock()
  const secs = Math.round(frac * 3600)

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-inner">
        <Link href="/" className="brand" aria-label="AI60 home">
          <span className="brand-mark" aria-hidden>
            <small>AI</small>60
          </span>
          <span className="brand-text">
            <b>AI60</b>
            <span>by NxtWave</span>
          </span>
        </Link>

        <div className="scroll-clock" aria-hidden title="Scrolling this page = the 60-minute workshop">
          <span className="clock-dot" />
          <span className="mono">
            {pad(Math.floor(secs / 60))}:{pad(secs % 60)}
            <span className="clock-total"> / 60:00</span>
          </span>
          <span className="clock-label">{label}</span>
        </div>

        <div className="nav-links">
          <a href="#interview">The question</a>
          <a href="#lab">Lab record</a>
          <a href="#seats">Seats</a>
          <a href="#batch">Batch</a>
          <a href="#viva">Viva</a>
        </div>

        <button className="btn btn-sm" onClick={openRegister}>
          {me ? `My ticket · #${me.seat}` : 'Get hall ticket'}
        </button>
      </div>
      <div className="nav-progress" style={{ transform: `scaleX(${frac})` }} aria-hidden />
    </nav>
  )
}
