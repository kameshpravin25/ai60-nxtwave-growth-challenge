import type { Campaign, PrivateSeat, RegisterInput, RegisterResult, Seat, Store } from '../types'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config'
import { DAY, HOUR, startOfDayIST } from './time'

/**
 * LIVE MODE: Supabase Postgres via PostgREST RPCs (see supabase/schema.sql).
 * The anon key can only call security-definer functions; the table itself has RLS with no policies,
 * so phone numbers and emails never leave the database except through admin_export(key).
 */

interface Row {
  seat: number
  code: string
  name: string
  college: string
  branch: Seat['branch']
  grad_year: number
  referred_by: string | null
  source: Seat['source']
  campaign: string | null
  created_at: string
  full_name?: string
  email?: string
  phone?: string
  existing?: boolean
}

async function rpc<T>(fn: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}))
    throw new Error(detail?.message || `Request failed (${res.status})`)
  }
  return res.json() as Promise<T>
}

const toSeat = (r: Row): Seat => ({
  seat: r.seat,
  code: r.code,
  name: r.name,
  college: r.college,
  branch: r.branch,
  gradYear: r.grad_year,
  referredBy: r.referred_by,
  source: r.source,
  campaign: r.campaign,
  createdAt: Date.parse(r.created_at),
})

function liveCampaign(): Campaign {
  const workshopAt = Date.parse(import.meta.env.VITE_WORKSHOP_AT ?? '')
  const start = Date.parse(import.meta.env.VITE_CAMPAIGN_START ?? '')
  if (Number.isFinite(workshopAt) && Number.isFinite(start)) return { start, workshopAt }
  // Fallback: the coming Sunday 7 PM IST, campaign started 6 days earlier.
  const today = startOfDayIST(Date.now())
  const dow = new Date(today + 5.5 * HOUR).getUTCDay()
  const sunday = today + ((7 - dow) % 7 || 7) * DAY
  return { start: sunday - 6 * DAY, workshopAt: sunday + 19 * HOUR }
}

export function createLiveStore(): Store {
  const campaign = liveCampaign()
  return {
    mode: 'live',
    campaign: () => campaign,

    async seats() {
      const rows = await rpc<Row[]>('public_seats')
      return rows.map(toSeat).sort((a, b) => a.seat - b.seat)
    },

    async register(input: RegisterInput): Promise<RegisterResult> {
      const row = await rpc<Row>('register', {
        p_name: input.name.trim(),
        p_email: input.email.trim().toLowerCase(),
        p_phone: input.phone.replace(/\D/g, '').slice(-10),
        p_college: input.college,
        p_branch: input.branch,
        p_grad_year: input.gradYear,
        p_referred_by: input.referredBy,
        p_source: input.source,
        p_campaign: input.campaign,
      })
      return { seat: toSeat(row), existing: Boolean(row.existing) }
    },

    async findTicket(phone: string, email: string) {
      const rows = await rpc<Row[]>('find_ticket', {
        p_phone: phone.replace(/\D/g, '').slice(-10),
        p_email: email.trim().toLowerCase(),
      })
      return rows[0] ? toSeat(rows[0]) : null
    },

    async exportRows(adminKey: string): Promise<PrivateSeat[]> {
      const rows = await rpc<Row[]>('admin_export', { p_key: adminKey })
      return rows.map((r) => ({ ...toSeat(r), fullName: r.full_name ?? r.name, email: r.email ?? '', phone: r.phone ?? '' }))
    },
  }
}
