import type { Source } from '../types'

export interface Attribution {
  ref: string | null
  source: Source
  campaign: string | null
}

const KEY = 'ai60_attr'
const ME_KEY = 'ai60_me'
const SOURCES: Source[] = ['captain', 'referral', 'club', 'linkedin', 'instagram', 'email', 'bot', 'direct']
const ALIASES: Record<string, Source> = { wa: 'captain', whatsapp: 'captain', li: 'linkedin', ig: 'instagram', mail: 'email' }
const NONE: Attribution = { ref: null, source: 'direct', campaign: null }

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* private mode: just won't persist */
  }
}

/**
 * Called once on load. The last non-direct touch wins. Link formats:
 *   ?ref=AI60-7K2Q            a student's share link (hall ticket QR, WhatsApp share)
 *   ?cap=CBIT-RAHUL           a Campus Captain's link for their class / placement group
 *   ?src=club&cap=GDG-VNR     a club or community link
 *   ?src=linkedin             organic posts
 */
export function captureAttribution(search = window.location.search): Attribution {
  const params = new URLSearchParams(search)
  const ref = params.get('ref')?.trim().toUpperCase() || null
  const cap = (params.get('cap') || params.get('utm_campaign'))?.trim().toUpperCase() || null
  const rawSrc = (params.get('src') || params.get('utm_source'))?.trim().toLowerCase() || null
  const mapped = rawSrc ? (ALIASES[rawSrc] ?? (SOURCES.includes(rawSrc as Source) ? (rawSrc as Source) : null)) : null

  const stored = read<Attribution>(KEY)
  if (!ref && !cap && !mapped) return stored ?? NONE

  const next: Attribution = {
    ref: ref ?? stored?.ref ?? null,
    source: ref ? 'referral' : (mapped ?? (cap ? 'captain' : 'direct')),
    campaign: cap,
  }
  write(KEY, next)
  return next
}

export const getAttribution = (): Attribution => read<Attribution>(KEY) ?? NONE

export function getMyCode(): string | null {
  try {
    return localStorage.getItem(ME_KEY)
  } catch {
    return null
  }
}

export function setMyCode(code: string) {
  try {
    localStorage.setItem(ME_KEY, code)
  } catch {
    /* ignore */
  }
}

export function shareLink(code: string): string {
  return `${window.location.origin}/?ref=${encodeURIComponent(code)}`
}
