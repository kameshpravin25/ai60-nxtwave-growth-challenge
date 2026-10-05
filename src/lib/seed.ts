import type { Branch, Seat, Source } from '../types'
import { HOURLY_ACTIVITY } from '../config'
import { CAPTAINS, CLUBS, FIRST_NAMES, LAST_INITIALS, ORGANIC_COLLEGES } from '../data/demoWorld'
import { prng, makeCode } from './rand'
import { DAY, HOUR } from './time'

export type SeedRow = Omit<Seat, 'seat'>

/** New registrations per campaign day in the simulation (cumulative: 62, 141, 214, 283, 349, 423, 515). */
const DAILY = [62, 79, 73, 69, 66, 74, 92]

const BRANCH_MIX: Array<[Branch, number]> = [
  ['CSE', 34], ['IT', 10], ['ECE', 18], ['EEE', 10], ['MECH', 13], ['CIVIL', 8], ['OTHER', 7],
]

/**
 * Generates the whole 7-day simulated campaign. Rows in the future are filtered out at read time,
 * so the demo "fills up" in real time. A short burst right after the first visit makes the seat map
 * visibly move while someone is evaluating the page.
 */
export function generateSeeds(campaignStart: number, firstVisit: number): SeedRow[] {
  const r = prng(60)
  const times: number[] = []

  DAILY.forEach((count, day) => {
    for (let i = 0; i < count; i++) {
      const hour = r.weighted(HOURLY_ACTIVITY.map((_, h) => h), (h) => HOURLY_ACTIVITY[h])
      times.push(campaignStart + day * DAY + hour * HOUR + Math.floor(r.next() * HOUR))
    }
  })
  let t = firstVisit + 25_000
  for (let i = 0; i < 14; i++) {
    times.push(t)
    t += 30_000 + Math.floor(r.next() * 45_000)
  }
  times.sort((a, b) => a - b)

  const rows: SeedRow[] = []
  const refCount = new Map<string, number>()
  const usedCodes = new Set<string>()

  for (const createdAt of times) {
    const day = Math.max(0, Math.floor((createdAt - campaignStart) / DAY))
    const weights: Array<[Source, number]> = [
      ['captain', day <= 1 ? 0.62 : 0.46],
      ['referral', rows.length > 15 ? 0.12 + 0.045 * day : 0],
      ['club', day >= 2 ? 0.2 : 0.05],
      ['linkedin', 0.05],
      ['instagram', 0.02],
      ['email', 0.01],
      ['direct', 0.025],
    ]
    const source = r.weighted(weights, ([, w]) => w)[0]

    let college = r.weighted(ORGANIC_COLLEGES, ([, w]) => w)[0]
    let branch = r.weighted(BRANCH_MIX, ([, w]) => w)[0]
    let campaign: string | null = null
    let referredBy: string | null = null

    if (source === 'captain') {
      const active = CAPTAINS.filter((c) => c.activeFromDay <= day)
      const cap = r.weighted(active, (c) => c.strength)
      campaign = cap.code
      if (r.next() < 0.88) college = cap.college
    } else if (source === 'club') {
      const club = r.weighted(CLUBS, (c) => c.strength)
      campaign = club.code
      if (r.next() < 0.8) college = club.college
    } else if (source === 'referral') {
      // Preferential attachment: people who already brought friends keep bringing more.
      const parent = r.weighted(rows, (p) => 1 + 3 * (refCount.get(p.code) ?? 0))
      referredBy = parent.code
      refCount.set(parent.code, (refCount.get(parent.code) ?? 0) + 1)
      if (r.next() < 0.82) college = parent.college // batchmates
      if (r.next() < 0.7) branch = parent.branch
    }

    let code = makeCode(r.next)
    while (usedCodes.has(code)) code = makeCode(r.next)
    usedCodes.add(code)

    const yearRoll = r.next()
    rows.push({
      code,
      name: `${r.pick(FIRST_NAMES)} ${LAST_INITIALS[Math.floor(r.next() * LAST_INITIALS.length)]}.`,
      college,
      branch,
      gradYear: yearRoll < 0.82 ? 2027 : yearRoll < 0.94 ? 2028 : 2026,
      referredBy,
      source,
      campaign,
      createdAt,
    })
  }
  return rows
}
