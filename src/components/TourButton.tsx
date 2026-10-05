import { useApp } from '../lib/state'
import { Link, usePath } from '../lib/router'

/** Demo-mode only: reviewers land on a student-facing page, so give them a way to find every tool. */
export default function TourButton() {
  const { mode } = useApp()
  const path = usePath()
  if (mode !== 'demo' || path === '/tour' || path === '/live' || path.startsWith('/verify/')) return null
  return (
    <Link href="/tour" className="tour-fab" aria-label="Reviewer tour">
      <span aria-hidden>🧭</span> <span className="tour-fab-text">Reviewer tour</span>
    </Link>
  )
}
