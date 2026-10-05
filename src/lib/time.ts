export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
const IST_OFFSET = 5.5 * HOUR

export function startOfDayIST(t: number): number {
  return Math.floor((t + IST_OFFSET) / DAY) * DAY - IST_OFFSET
}

/** 0-based campaign day index for timestamp t. */
export function dayIndex(t: number, campaignStart: number): number {
  return Math.floor((startOfDayIST(t) - startOfDayIST(campaignStart)) / DAY)
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...opts })
const dayFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short' })
const longDayFmt = fmt({ weekday: 'long', day: 'numeric', month: 'long' })
const timeFmt = fmt({ hour: 'numeric', minute: '2-digit', hour12: true })
const shortDateFmt = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' })

export const formatDay = (t: number) => dayFmt.format(t)
export const formatLongDay = (t: number) => longDayFmt.format(t)
export const formatTime = (t: number) => timeFmt.format(t).toUpperCase()
export const formatShortDate = (t: number) => shortDateFmt.format(t)

export function relative(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function countdownParts(ms: number) {
  const clamped = Math.max(0, ms)
  return {
    d: Math.floor(clamped / DAY),
    h: Math.floor((clamped % DAY) / HOUR),
    m: Math.floor((clamped % HOUR) / MIN),
    s: Math.floor((clamped % MIN) / 1000),
  }
}

export const pad = (n: number, w = 2) => String(n).padStart(w, '0')
