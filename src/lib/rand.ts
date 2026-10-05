/** Small deterministic PRNG (mulberry32) so the demo world is identical on every load. */
export function prng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    weighted: <T,>(items: readonly T[], weight: (item: T) => number): T => {
      const total = items.reduce((sum, it) => sum + weight(it), 0)
      let r = next() * total
      for (const it of items) {
        r -= weight(it)
        if (r <= 0) return it
      }
      return items[items.length - 1]
    },
  }
}

const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export function makeCode(rand: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 4; i++) s += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)]
  return `AI60-${s}`
}

/** "priya sharma" -> "Priya S." (what the public leaderboard and seat map show). */
export function displayName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Someone'
  const first = parts[0][0].toUpperCase() + parts[0].slice(1).toLowerCase()
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first
}

export function initials(name: string): string {
  const parts = name.replace(/\./g, '').trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}
