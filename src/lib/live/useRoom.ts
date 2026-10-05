import { useEffect, useReducer, useState } from 'react'
import { useApp } from '../state'
import type { Branch } from '../../types'
import { reduce } from './reducer'
import { autopilotEvents, simulateBots } from './sim'
import { transport } from './transport'
import type { AttendeeEvent, HostEvent, LiveEvent, RoomState } from './types'

const HOST_KINDS = new Set(['step', 'poll', 'poll_close', 'quiz', 'answered', 'resolve', 'announce', 'reset'])
export const isHostEvent = (e: LiveEvent) => HOST_KINDS.has(e.kind)

export interface Identity {
  who: string
  name: string
  college: string
  branch: Branch
  gold: boolean
  guest: boolean
}

export interface Room {
  room: RoomState
  now: number
  session: ReturnType<typeof transport.session>
  mode: 'demo' | 'live'
  post: (who: string, e: AttendeeEvent) => Promise<void>
  host: (e: HostEvent, key?: string) => Promise<void>
  restart: () => void
}

/** The whole room, recomputed once a second from the event log (+ the simulation in demo mode). */
export function useRoom(): Room {
  const { seats, me, refCounts } = useApp()
  const [, bump] = useReducer((x: number) => x + 1, 0)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    transport.ensureSession()
    const unsubscribe = transport.subscribe(bump)
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => {
      unsubscribe()
      window.clearInterval(id)
    }
  }, [])

  const logged = transport.events()
  const session = transport.session()
  const loggedHost = logged.filter(isHostEvent)
  const hostEvents = session?.mode === 'autopilot' ? [...autopilotEvents(session.start, now), ...loggedHost] : loggedHost
  const bots = transport.mode === 'demo' ? simulateBots({ hostEvents, roster: seats, refCounts, exclude: me?.code, now }) : []
  const room = reduce([...logged.filter((e) => !isHostEvent(e)), ...hostEvents, ...bots])

  return {
    room,
    now,
    session,
    mode: transport.mode,
    post: (who, e) => transport.post(who, e),
    host: (e, key) => transport.host(e, key),
    restart: () => transport.restart(),
  }
}

const GUEST_KEY = 'ai60_guest'

export function useIdentity(): [Identity | null, (name: string) => void] {
  const { me, refCounts, mode } = useApp()
  const [guest, setGuest] = useState<Identity | null>(() => {
    try {
      const raw = localStorage.getItem(GUEST_KEY)
      return raw ? (JSON.parse(raw) as Identity) : null
    } catch {
      return null
    }
  })

  const becomeGuest = (name: string) => {
    const g: Identity = { who: `G-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, name: name.trim() || 'Guest', college: 'Guest', branch: 'CSE', gold: false, guest: true }
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(g))
    } catch {
      /* ignore */
    }
    setGuest(g)
  }

  if (me) return [{ who: me.code, name: me.name, college: me.college, branch: me.branch, gold: (refCounts.get(me.code) ?? 0) >= 3, guest: false }, becomeGuest]
  return [mode === 'demo' ? guest : null, becomeGuest]
}
