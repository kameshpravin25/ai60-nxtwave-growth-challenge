import type { Seat } from '../types'
import type { TicketData, TicketTier } from './ticket'
import { tierFor } from './analytics'
import { shareLink } from './attribution'
import { displayName } from './rand'

export function ticketFor(seat: Seat, fullName: string | null, workshopAt: number, refCount: number, stamp = true): TicketData {
  const { current } = tierFor(refCount)
  // Only trust the locally remembered full name if it belongs to this seat.
  const name = fullName && displayName(fullName) === seat.name ? fullName : seat.name
  return {
    name,
    college: seat.college,
    branch: seat.branch === 'OTHER' ? 'Other' : seat.branch,
    gradYear: seat.gradYear,
    seat: seat.seat,
    code: seat.code,
    workshopAt,
    link: shareLink(seat.code),
    tier: (current?.key ?? 'standard') as TicketTier,
    refCount,
    stamp,
  }
}
