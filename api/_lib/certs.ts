import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Certificates are self-contained signed tokens (payload.signature, HMAC-SHA256), so anyone can verify
 * one at /verify/<token> without a database. Set CERT_SECRET in production; the fallback key is public.
 */

export interface CertPayload {
  v: 1
  id: string
  n: string
  c: string
  b: string
  p: string
  u: string
  s: number
  g: string
  k: string
  d: number
  /** Present on demo runs against a public sample project. */
  x?: 1
}

const DEMO_SECRET = 'ai60-demo-signing-key'
const secret = () => process.env.CERT_SECRET || DEMO_SECRET
export const isDemoSecret = () => !process.env.CERT_SECRET

const b64url = (buf: Buffer) => buf.toString('base64url')
const sign = (body: string) => b64url(createHmac('sha256', secret()).update(body).digest())

export function issue(fields: Omit<CertPayload, 'v' | 'id' | 'd'>): string {
  const payload: CertPayload = { v: 1, id: randomBytes(5).toString('hex').toUpperCase(), d: Date.now(), ...fields }
  const body = b64url(Buffer.from(JSON.stringify(payload)))
  return `${body}.${sign(body)}`
}

export function verify(token: string): { valid: boolean; payload: CertPayload | null } {
  const [body, sig] = token.split('.')
  if (!body || !sig) return { valid: false, payload: null }
  let payload: CertPayload | null = null
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as CertPayload
  } catch {
    return { valid: false, payload: null }
  }
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(sig)
  return { valid: expected.length === given.length && timingSafeEqual(expected, given), payload }
}
