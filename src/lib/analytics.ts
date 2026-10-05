import type { Campaign, Seat, Source } from '../types'
import { CAMPAIGN_DAYS, DAILY_TARGETS, HOURLY_ACTIVITY, TIERS } from '../config'
import { DAY, dayIndex, startOfDayIST } from './time'

export type Tier = (typeof TIERS)[number]

export function referralCounts(seats: Seat[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of seats) if (s.referredBy) counts.set(s.referredBy, (counts.get(s.referredBy) ?? 0) + 1)
  return counts
}

export function tierFor(count: number): { current: Tier | null; next: Tier | null } {
  let current: Tier | null = null
  for (const t of TIERS) if (count >= t.at) current = t
  return { current, next: TIERS.find((t) => count < t.at) ?? null }
}

export function tally<K extends string | number>(seats: Seat[], key: (s: Seat) => K | null): Array<{ key: K; count: number }> {
  const m = new Map<K, number>()
  for (const s of seats) {
    const k = key(s)
    if (k !== null) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count)
}

export function referrerBoard(seats: Seat[], limit = 5): Array<{ seat: Seat; count: number }> {
  const counts = referralCounts(seats)
  const byCode = new Map(seats.map((s) => [s.code, s]))
  return [...counts.entries()]
    .map(([code, count]) => ({ seat: byCode.get(code)!, count }))
    .filter((r) => r.seat)
    .sort((a, b) => b.count - a.count || a.seat.seat - b.seat.seat)
    .slice(0, limit)
}

export interface DayStat {
  index: number
  date: number
  count: number
  cumulative: number
  target: number
  status: 'past' | 'today' | 'future'
}

export function daily(seats: Seat[], campaign: Campaign, now: number): DayStat[] {
  const today = dayIndex(now, campaign.start)
  const counts = new Array(CAMPAIGN_DAYS).fill(0)
  for (const s of seats) {
    const d = Math.min(CAMPAIGN_DAYS - 1, Math.max(0, dayIndex(s.createdAt, campaign.start)))
    counts[d]++
  }
  let cumulative = 0
  return counts.map((count, index) => {
    cumulative += count
    return {
      index,
      date: startOfDayIST(campaign.start) + index * DAY,
      count,
      cumulative,
      target: DAILY_TARGETS[index],
      status: index < today ? 'past' : index === today ? 'today' : 'future',
    }
  })
}

export interface Pacing {
  day: number
  total: number
  targetNow: number
  gap: number
  daysLeft: number
  requiredPerDay: number
  projected: number
}

/** Share of a day's registrations expected by time t, following the hourly activity curve. */
function activityShare(hoursIntoDay: number): number {
  const total = HOURLY_ACTIVITY.reduce((s, w) => s + w, 0)
  const whole = Math.floor(hoursIntoDay)
  let done = HOURLY_ACTIVITY.slice(0, whole).reduce((s, w) => s + w, 0)
  if (whole < 24) done += HOURLY_ACTIVITY[whole] * (hoursIntoDay - whole)
  return Math.min(1, done / total)
}

export function pacing(seats: Seat[], campaign: Campaign, now: number): Pacing {
  const idx = Math.min(CAMPAIGN_DAYS - 1, Math.max(0, dayIndex(now, campaign.start)))
  const dayStart = startOfDayIST(campaign.start) + idx * DAY
  const frac = Math.min(1, Math.max(0, (now - dayStart) / DAY))
  const prevTarget = idx === 0 ? 0 : DAILY_TARGETS[idx - 1]
  const targetNow = Math.round(prevTarget + (DAILY_TARGETS[idx] - prevTarget) * activityShare(frac * 24))
  const total = seats.length
  const daysLeft = CAMPAIGN_DAYS - idx - frac

  const days = daily(seats, campaign, now)
  const complete = days.filter((d) => d.status === 'past').slice(-2)
  const runRate = complete.length ? complete.reduce((s, d) => s + d.count, 0) / complete.length : total / Math.max(frac, 0.25)
  const goal = DAILY_TARGETS[CAMPAIGN_DAYS - 1]

  return {
    day: idx + 1,
    total,
    targetNow,
    gap: total - targetNow,
    daysLeft,
    requiredPerDay: Math.max(0, Math.ceil((goal - total) / Math.max(daysLeft, 0.5))),
    projected: Math.round(total + runRate * daysLeft),
  }
}

export function kFactor(seats: Seat[]): number {
  const referred = seats.filter((s) => s.referredBy).length
  const seeds = seats.length - referred
  return seeds ? referred / seeds : 0
}

export interface CampaignRow {
  code: string
  count: number
  last24h: number
  college: string
  lastAt: number
}

export function campaignBoard(seats: Seat[], source: Source, now: number): CampaignRow[] {
  const rows = new Map<string, Seat[]>()
  for (const s of seats) if (s.source === source && s.campaign) rows.set(s.campaign, [...(rows.get(s.campaign) ?? []), s])
  return [...rows.entries()]
    .map(([code, list]) => ({
      code,
      count: list.length,
      last24h: list.filter((s) => now - s.createdAt < DAY).length,
      college: tally(list, (s) => s.college)[0]?.key ?? '—',
      lastAt: Math.max(...list.map((s) => s.createdAt)),
    }))
    .sort((a, b) => b.count - a.count)
}

export interface Insight {
  tone: 'good' | 'warn' | 'bad'
  title: string
  body: string
}

/** Rule-based "what should I do next" calls. A growth intern's morning stand-up, automated. */
export function insights(seats: Seat[], campaign: Campaign, now: number): Insight[] {
  const out: Insight[] = []
  const p = pacing(seats, campaign, now)

  if (p.gap < -8) {
    out.push({
      tone: p.gap < -30 ? 'bad' : 'warn',
      title: `Behind pace by ${-p.gap} seats`,
      body: `${p.total} registered vs ${p.targetNow} planned by now. Need ${p.requiredPerDay}/day to reach 500. ${p.day >= 5 ? 'Deploy the ₹300 reserve on the best-converting college today.' : 'Push the referral nudge to everyone who registered yesterday.'}`,
    })
  } else {
    out.push({ tone: 'good', title: 'On pace for 500', body: `${p.total} registered vs ${p.targetNow} planned by now. Projected finish: ~${p.projected}.` })
  }

  const captains = campaignBoard(seats, 'captain', now)
  const stalled = captains.filter((c) => c.last24h === 0 && c.count < 6)
  if (stalled.length) {
    out.push({
      tone: 'warn',
      title: `${stalled.length} captain${stalled.length > 1 ? 's' : ''} stalled`,
      body: `${stalled.map((c) => c.code).join(', ')}: no seats in 24h. Call them today. Share the Day-5 creative, or swap in a backup CR from the same college.`,
    })
  }
  if (captains[0]) {
    const share = Math.round((captains[0].count / captains.reduce((s, c) => s + c.count, 0)) * 100)
    out.push({
      tone: 'good',
      title: `${captains[0].code} is the top captain`,
      body: `${share}% of all captain-driven seats. Ask them to introduce 2 CRs from other sections. Their playbook works.`,
    })
  }

  const recent = seats.filter((s) => now - s.createdAt < DAY)
  if (recent.length >= 10) {
    const recentRef = recent.filter((s) => s.referredBy).length / recent.length
    const allRef = seats.filter((s) => s.referredBy).length / Math.max(1, seats.length)
    if (recentRef > allRef + 0.03) {
      out.push({
        tone: 'good',
        title: 'Referral loop is compounding',
        body: `${Math.round(recentRef * 100)}% of the last 24h came from hall-ticket shares (vs ${Math.round(allRef * 100)}% overall). Send the "2 more for Gold" nudge.`,
      })
    }
  }

  const nonCs = seats.filter((s) => s.branch !== 'CSE' && s.branch !== 'IT').length / Math.max(1, seats.length)
  out.push({
    tone: nonCs > 0.4 ? 'good' : 'warn',
    title: `${Math.round(nonCs * 100)}% of seats are non-CS branches`,
    body:
      nonCs > 0.4
        ? 'Branch-specific projects are widening the funnel beyond CSE. Keep the MECH/CIVIL/ECE creatives in rotation.'
        : 'The audience is skewing CSE. Lead with the core-branch projects in the next WhatsApp push.',
  })
  return out
}
