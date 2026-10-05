import type { Campaign, PrivateSeat, RegisterInput, RegisterResult, Seat, Store } from '../types'
import { generateSeeds, type SeedRow } from './seed'
import { displayName, makeCode } from './rand'
import { DAY, HOUR, startOfDayIST } from './time'

/**
 * DEMO MODE: a simulated campaign that always opens on "Day 5 of 7" relative to your first visit.
 * Seeded rows are fictional; rows you register are stored only in this browser (localStorage).
 * Seat numbers are the rank by registration time, so a seat you claim never changes.
 */

const KEY = 'ai60_demo_v1'

interface UserRow extends SeedRow {
  fullName: string
  email: string
  phone: string
}

interface DemoState {
  firstVisit: number
  rows: UserRow[]
}

function campaignFor(firstVisit: number): Campaign {
  const start = startOfDayIST(firstVisit) - 4 * DAY
  return { start, workshopAt: start + 6 * DAY + 19 * HOUR }
}

function load(): DemoState {
  const now = Date.now()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const state = JSON.parse(raw) as DemoState
      // Once the simulated workshop is over, start a fresh simulated week.
      if (now < campaignFor(state.firstVisit).workshopAt + 3 * HOUR) return state
    }
  } catch {
    /* fall through */
  }
  return { firstVisit: now, rows: [] }
}

export function createDemoStore(): Store {
  let state = load()
  let seeds = generateSeeds(campaignFor(state.firstVisit).start, state.firstVisit)

  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* private mode: registrations last for this tab only */
    }
  }
  save()

  const all = (): Seat[] => {
    const now = Date.now()
    const merged: SeedRow[] = [...seeds.filter((s) => s.createdAt <= now), ...state.rows]
    merged.sort((a, b) => a.createdAt - b.createdAt)
    return merged.map((row, i) => ({
      seat: i + 1,
      code: row.code,
      name: row.name,
      college: row.college,
      branch: row.branch,
      gradYear: row.gradYear,
      referredBy: row.referredBy,
      source: row.source,
      campaign: row.campaign,
      createdAt: row.createdAt,
    }))
  }

  const bySeatCode = (code: string) => all().find((s) => s.code === code) ?? null

  return {
    mode: 'demo',
    campaign: () => campaignFor(state.firstVisit),

    async seats() {
      const fresh = load()
      if (fresh.firstVisit !== state.firstVisit) {
        state = fresh
        seeds = generateSeeds(campaignFor(state.firstVisit).start, state.firstVisit)
        save()
      } else {
        state = fresh
      }
      return all()
    },

    async register(input: RegisterInput): Promise<RegisterResult> {
      await new Promise((res) => setTimeout(res, 650)) // feels like a network call
      state = load() // another tab (e.g. a friend's referral link) may have registered meanwhile
      const email = input.email.trim().toLowerCase()
      const phone = input.phone.replace(/\D/g, '').slice(-10)
      const dupe = state.rows.find((r) => r.email === email || r.phone === phone)
      if (dupe) return { seat: bySeatCode(dupe.code)!, existing: true }

      const taken = new Set([...seeds.map((s) => s.code), ...state.rows.map((r) => r.code)])
      let code = makeCode()
      while (taken.has(code)) code = makeCode()

      const referrerExists = input.referredBy && taken.has(input.referredBy)
      state.rows.push({
        code,
        fullName: input.name.trim(),
        name: displayName(input.name),
        email,
        phone,
        college: input.college,
        branch: input.branch,
        gradYear: input.gradYear,
        referredBy: referrerExists ? input.referredBy : null,
        source: referrerExists ? 'referral' : input.source === 'referral' ? 'direct' : input.source,
        campaign: input.campaign,
        createdAt: Date.now(),
      })
      save()
      return { seat: bySeatCode(code)!, existing: false }
    },

    async findTicket(phone: string, email: string) {
      const p = phone.replace(/\D/g, '').slice(-10)
      const e = email.trim().toLowerCase()
      const row = state.rows.find((r) => r.phone === p && r.email === e)
      return row ? bySeatCode(row.code) : null
    },

    async exportRows(): Promise<PrivateSeat[]> {
      const mine = new Map(state.rows.map((r) => [r.code, r]))
      return all().map((s) => {
        const own = mine.get(s.code)
        if (own) return { ...s, fullName: own.fullName, email: own.email, phone: own.phone }
        // Seeded people get obviously synthetic contact details.
        const handle = s.name.toLowerCase().replace(/[^a-z]/g, '')
        return { ...s, fullName: s.name, email: `${handle}.${s.code.slice(5).toLowerCase()}@example.com`, phone: `90000${String(s.seat).padStart(5, '0')}` }
      })
    },
  }
}
