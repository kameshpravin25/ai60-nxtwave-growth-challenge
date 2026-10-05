import type { AttendeeEvent, HostEvent, LiveEvent } from './types'
import { IS_LIVE, SUPABASE_ANON_KEY, SUPABASE_URL } from '../../config'
import { autopilotEvents } from './sim'

export interface DemoSession {
  mode: 'autopilot' | 'manual'
  start: number
}

export interface Transport {
  mode: 'demo' | 'live'
  events(): LiveEvent[]
  session(): DemoSession | null
  subscribe(cb: () => void): () => void
  /** Demo: make sure a session exists (starts the autopilot host on first visit). */
  ensureSession(): void
  /** Demo: wipe the room and start a fresh autopilot run. */
  restart(): void
  post(who: string, e: AttendeeEvent): Promise<void>
  host(e: HostEvent, key?: string): Promise<void>
  /** Live: exchange hall-ticket code + phone for a room token. */
  join(code: string, phone: string): Promise<void>
  hasToken(): boolean
}

const HOST_CONTROLS = new Set(['step', 'poll', 'poll_close', 'quiz', 'reset'])
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

/* ---------------- Demo: localStorage + BroadcastChannel ---------------- */

function demoTransport(): Transport {
  const KEY = 'ai60_live_v1'
  const SESSION_TTL = 2 * 60 * 60 * 1000
  interface Stored {
    session: DemoSession | null
    events: LiveEvent[]
  }
  const listeners = new Set<() => void>()
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ai60_live') : null

  const read = (): Stored => {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw) as Stored
    } catch {
      /* fall through */
    }
    return { session: null, events: [] }
  }
  let state = read()
  const notify = () => listeners.forEach((l) => l())
  const write = (next: Stored) => {
    state = next
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* private mode: this tab only */
    }
    channel?.postMessage('changed')
    notify()
  }
  const reload = () => {
    state = read()
    notify()
  }
  channel?.addEventListener('message', reload)
  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => e.key === KEY && reload())

  return {
    mode: 'demo',
    events: () => state.events,
    session: () => state.session,
    subscribe(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    ensureSession() {
      const s = state.session
      if (!s || Date.now() - s.start > SESSION_TTL) write({ session: { mode: 'autopilot', start: Date.now() }, events: [] })
    },
    restart() {
      write({ session: { mode: 'autopilot', start: Date.now() }, events: [] })
    },
    async post(who, e) {
      state = read()
      write({ ...state, events: [...state.events, { ...e, id: `u:${uid()}`, at: Date.now(), who } as LiveEvent] })
    },
    async host(e) {
      state = read()
      let events = state.events
      let session = state.session
      // A human taking a scheduling control ends the autopilot: freeze what it already did into the log.
      if (session?.mode === 'autopilot' && HOST_CONTROLS.has(e.kind)) {
        events = [...events, ...autopilotEvents(session.start, Date.now())]
        session = { ...session, mode: 'manual' }
      }
      write({ session, events: [...events, { ...e, id: `h:${uid()}`, at: Date.now(), who: 'host' } as LiveEvent] })
    },
    async join() {},
    hasToken: () => true,
  }
}

/* ---------------- Live: Supabase RPCs, polled ---------------- */

function liveTransport(): Transport {
  const TOKEN_KEY = 'ai60_live_token'
  const listeners = new Set<() => void>()
  let events: LiveEvent[] = []
  let lastId = 0
  let timer: number | undefined

  const rpc = async <T,>(fn: string, body: Record<string, unknown>): Promise<T> => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}))
      throw new Error(detail?.message || `Request failed (${res.status})`)
    }
    return res.json() as Promise<T>
  }

  interface Row {
    id: number
    who: string
    kind: string
    payload: Record<string, unknown>
    created_at: string
  }

  const pull = async () => {
    const rows = await rpc<Row[]>('live_since', { p_after: lastId }).catch(() => [] as Row[])
    if (!rows.length) return
    lastId = rows[rows.length - 1].id
    events = [
      ...events,
      ...rows.map((r) => ({ ...r.payload, id: String(r.id).padStart(12, '0'), at: Date.parse(r.created_at), who: r.who, kind: r.kind }) as LiveEvent),
    ]
    listeners.forEach((l) => l())
  }

  const token = () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  }

  const split = (e: AttendeeEvent | HostEvent) => {
    const { kind, ...payload } = e
    return { p_kind: kind, p_payload: payload }
  }

  return {
    mode: 'live',
    events: () => events,
    session: () => null,
    subscribe(cb) {
      listeners.add(cb)
      if (listeners.size === 1) {
        pull()
        timer = window.setInterval(pull, 2000)
      }
      return () => {
        listeners.delete(cb)
        if (!listeners.size) window.clearInterval(timer)
      }
    },
    ensureSession() {},
    restart() {},
    async post(_who, e) {
      await rpc('live_post', { p_token: token(), ...split(e) })
      await pull()
    },
    async host(e, key) {
      await rpc('live_host', { p_key: key ?? '', ...split(e) })
      await pull()
    },
    async join(code, phone) {
      const t = await rpc<string>('live_join', { p_code: code.trim().toUpperCase(), p_phone: phone.replace(/\D/g, '').slice(-10) })
      localStorage.setItem(TOKEN_KEY, t)
    },
    hasToken: () => Boolean(token()),
  }
}

export const transport: Transport = IS_LIVE ? liveTransport() : demoTransport()
