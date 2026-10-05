import { createHmac, timingSafeEqual } from 'node:crypto'
import { newSession, step, type WaDeps, type WaIn, type WaOut, type WaSession } from '../src/lib/wa/flow.js'
import { evaluate } from './_lib/evaluator.js'

/**
 * WhatsApp Cloud API webhook for the AI60 bot: the same flow engine as the /whatsapp simulator.
 *
 * Env: WA_TOKEN, WA_PHONE_NUMBER_ID, WA_VERIFY_TOKEN, WA_APP_SECRET (signature check),
 *      SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY (conversation state),
 *      optional WA_GRAPH_VERSION (default v21.0), SITE_URL, VITE_WORKSHOP_AT.
 */

const env = (k: string) => process.env[k] ?? ''
const supabaseUrl = () => (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '')
const graphUrl = () => `${env('WA_API_BASE') || 'https://graph.facebook.com'}/${env('WA_GRAPH_VERSION') || 'v21.0'}/${env('WA_PHONE_NUMBER_ID')}/messages`
const siteUrl = () => (env('SITE_URL') || env('VITE_SITE_URL') || (env('VERCEL_PROJECT_PRODUCTION_URL') ? `https://${env('VERCEL_PROJECT_PRODUCTION_URL')}` : '')).replace(/\/$/, '')

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Meta's subscription handshake. */
export async function GET(request: Request): Promise<Response> {
  const p = new URL(request.url).searchParams
  if (p.get('hub.mode') === 'subscribe' && env('WA_VERIFY_TOKEN') && p.get('hub.verify_token') === env('WA_VERIFY_TOKEN')) {
    return new Response(p.get('hub.challenge') ?? '', { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

function signatureOk(raw: string, header: string | null): boolean {
  if (!env('WA_APP_SECRET')) return true
  if (!header?.startsWith('sha256=')) return false
  const expected = Buffer.from(createHmac('sha256', env('WA_APP_SECRET')).update(raw).digest('hex'))
  const given = Buffer.from(header.slice(7))
  return expected.length === given.length && timingSafeEqual(expected, given)
}

/* ---------------- Supabase (service role, server only) ---------------- */

async function supabase(path: string, init: RequestInit = {}): Promise<Response> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return fetch(`${supabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

async function loadSession(phone: string): Promise<WaSession | null> {
  const res = await supabase(`wa_sessions?phone=eq.${encodeURIComponent(phone)}&select=state`)
  if (!res.ok) return null
  const rows = (await res.json()) as Array<{ state: WaSession }>
  return rows[0]?.state ?? null
}

async function saveSession(phone: string, state: WaSession): Promise<void> {
  await supabase('wa_sessions', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ phone, state, updated_at: new Date().toISOString() }),
  })
}

/* ---------------- Outgoing messages ---------------- */

function toGraph(to: string, out: WaOut, site: string): Record<string, unknown> {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to }
  switch (out.type) {
    case 'text':
      return { ...base, type: 'text', text: { body: out.text, preview_url: true } }
    case 'buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: { type: 'button', body: { text: out.text }, action: { buttons: out.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) } },
      }
    case 'list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: out.text },
          action: { button: out.button.slice(0, 20), sections: [{ title: 'Options', rows: out.rows.slice(0, 10).map((r) => ({ id: r.id, title: r.title.slice(0, 24), ...(r.description ? { description: r.description.slice(0, 72) } : {}) })) }] },
        },
      }
    case 'ticket':
      return {
        ...base,
        type: 'interactive',
        interactive: { type: 'cta_url', body: { text: out.caption }, action: { name: 'cta_url', parameters: { display_text: 'Open my hall ticket', url: `${site}/?ref=${out.code}` } } },
      }
    case 'cta':
      return { ...base, type: 'interactive', interactive: { type: 'cta_url', body: { text: out.text }, action: { name: 'cta_url', parameters: { display_text: out.label.slice(0, 20), url: out.url } } } }
  }
}

async function sendAll(to: string, replies: WaOut[], site: string): Promise<void> {
  for (const out of replies) {
    const res = await fetch(graphUrl(), {
      method: 'POST',
      headers: { Authorization: `Bearer ${env('WA_TOKEN')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(toGraph(to, out, site)),
    })
    if (!res.ok) console.error('WhatsApp send failed', res.status, await res.text().catch(() => ''))
  }
}

/* ---------------- Incoming ---------------- */

interface IncomingMessage {
  from: string
  type: string
  text?: { body: string }
  interactive?: { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } }
  button?: { payload: string; text: string }
}

function toInput(m: IncomingMessage): WaIn | null {
  if (m.type === 'text' && m.text) return { type: 'text', text: m.text.body }
  const reply = m.interactive?.button_reply ?? m.interactive?.list_reply
  if (m.type === 'interactive' && reply) return { type: 'reply', id: reply.id, title: reply.title }
  if (m.type === 'button' && m.button) return { type: 'reply', id: m.button.payload, title: m.button.text }
  return null
}

const istFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
const calDate = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

function depsFor(phone: string, site: string): WaDeps {
  const workshopAt = Date.parse(env('VITE_WORKSHOP_AT')) || Date.now() + 3 * 86_400_000
  return {
    phone,
    siteUrl: site,
    workshopLabel: `${istFmt.format(workshopAt)} IST`,
    calendarUrl: `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: 'AI60 · Build Your First AI Project in 60 Minutes', dates: `${calDate(workshopAt)}/${calDate(workshopAt + 3_600_000)}` })}`,
    async register(input) {
      const res = await supabase('rpc/register', {
        method: 'POST',
        body: JSON.stringify({
          p_name: input.name,
          p_email: input.email,
          p_phone: input.phone,
          p_college: input.college,
          p_branch: input.branch,
          p_grad_year: input.gradYear,
          p_referred_by: null,
          p_source: 'bot',
          p_campaign: 'WA-BOT',
        }),
      })
      const row = (await res.json()) as { seat: number; code: string; name: string; existing: boolean; message?: string }
      if (!res.ok) throw new Error(row.message ?? 'Registration failed')
      return { seat: row.seat, code: row.code, name: row.name, existing: row.existing }
    },
    async evaluate(input) {
      for await (const ev of evaluate({ ...input, project: 'My AI project' })) {
        if (ev.type === 'result') {
          return { total: ev.total, pass: ev.pass, reasons: ev.reasons, fixes: ev.grade.fixes, certificateUrl: ev.certificate ? `${site}/verify/${ev.certificate}` : null }
        }
      }
      throw new Error('Evaluation failed')
    },
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!env('WA_TOKEN') || !env('WA_PHONE_NUMBER_ID') || !supabaseUrl() || !env('SUPABASE_SERVICE_ROLE_KEY')) {
    return json({ error: 'WhatsApp bot is not configured. See README → WhatsApp bot.' }, 501)
  }
  const raw = await request.text()
  if (!signatureOk(raw, request.headers.get('x-hub-signature-256'))) return json({ error: 'Bad signature' }, 401)

  let body: { entry?: Array<{ changes?: Array<{ value?: { messages?: IncomingMessage[] } }> }> }
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: 'Bad JSON' }, 400)
  }
  const messages = (body.entry ?? []).flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []))
  const site = siteUrl() || new URL(request.url).origin

  for (const m of messages) {
    const input = toInput(m)
    if (!input) continue
    const session = (await loadSession(m.from)) ?? newSession()
    const { session: next, replies } = await step(session, input, depsFor(m.from.replace(/\D/g, '').slice(-10), site))
    await saveSession(m.from, next)
    await sendAll(m.from, replies, site)
  }
  // Status callbacks (delivered/read) arrive here too; acknowledging them is enough.
  return json({ ok: true })
}
