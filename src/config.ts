const env = import.meta.env

export const SUPABASE_URL = (env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY ?? ''
export const IS_LIVE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const BUILDER_NAME = env.VITE_BUILDER_NAME || 'Kamesh Pravin'

export const SEAT_CAP = 500
export const CAMPAIGN_DAYS = 7
export const WORKSHOP_TITLE = 'Build Your First AI Project in 60 Minutes'

/** Cumulative registrations we must have by the END of each campaign day (Day 1..7). */
export const DAILY_TARGETS = [70, 150, 230, 300, 370, 440, 500]

/**
 * When students actually open WhatsApp, by IST hour (0..23): lunch break and late evening.
 * Used to pace the intra-day target so a quiet morning doesn't raise a false alarm.
 */
export const HOURLY_ACTIVITY = [1, 0.5, 0.3, 0.2, 0.2, 0.3, 0.8, 1.5, 2, 2, 2.2, 2.4, 3, 3.2, 2.6, 2.4, 2.6, 3, 3.6, 4.4, 4.8, 4.6, 3.6, 2]

/** Referral tiers: unlocked by the number of batchmates who registered with your code. */
export const TIERS = [
  { at: 1, key: 'pack', name: 'Prompt Pack', perk: '40 tested prompts for final-year projects, resumes and interview prep.' },
  { at: 3, key: 'batch', name: 'Batch Badge', perk: 'Gold hall ticket, plus a priority Q&A slot for your batch during the build.' },
  { at: 10, key: 'topper', name: 'Topper Review', perk: '15-minute 1:1 resume review with an NxtWave mentor.' },
] as const

export const BUDGET = [
  { item: 'Campus Captain bounties', amount: 1200, note: '₹300 each to the top 4 captains by verified registrations. Paid on results, never on reach.' },
  { item: 'Top 3 student referrers', amount: 500, note: '₹250 / ₹150 / ₹100 vouchers, shown live on the leaderboard.' },
  { item: 'Day-5 rescue reserve', amount: 300, note: 'Held back. Spent on Day 5 only if the dashboard shows we are behind pace.' },
] as const
