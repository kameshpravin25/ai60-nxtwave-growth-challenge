import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

/**
 * Fetches a student-submitted URL without letting it reach internal networks (SSRF):
 * only http(s), every hop's DNS answer is checked against private/reserved ranges,
 * redirects are followed manually (max 4), with a timeout and a response size cap.
 */

function v4Private(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number)
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) return v4Private(ip)
  const v6 = ip.toLowerCase()
  if (v6 === '::' || v6 === '::1') return true
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return v4Private(mapped[1])
  return /^(fc|fd|fe8|fe9|fea|feb)/.test(v6)
}

export interface FetchResult {
  status: number
  url: string
  text: string
  contentType: string
  latencyMs: number
}

export async function safeFetch(input: string, { timeoutMs = 8000, maxBytes = 400_000 } = {}): Promise<FetchResult> {
  let url = new URL(input)
  const started = Date.now()
  for (let hop = 0; hop < 5; hop++) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http(s) URLs are allowed')
    const host = url.hostname.replace(/^\[|\]$/g, '')
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
    if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new Error('That address is not publicly reachable')

    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'AI60-Evaluator/1.0 (+student project review)', accept: 'text/html,application/json,text/plain,*/*' },
    })
    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      url = new URL(location, url)
      continue
    }

    let text = ''
    if (res.body) {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let size = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        text += decoder.decode(value, { stream: true })
        if (size >= maxBytes) {
          await reader.cancel()
          break
        }
      }
    }
    return { status: res.status, url: url.href, text, contentType: res.headers.get('content-type') ?? '', latencyMs: Date.now() - started }
  }
  throw new Error('Too many redirects')
}
