import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Campaign, PrivateSeat, RegisterInput, RegisterResult, Seat, Store } from '../types'
import { IS_LIVE } from '../config'
import { createDemoStore } from './demoStore'
import { createLiveStore } from './liveStore'
import { captureAttribution, getMyCode, setMyCode, type Attribution } from './attribution'
import { referralCounts } from './analytics'

const store: Store = IS_LIVE ? createLiveStore() : createDemoStore()
const initialAttribution = captureAttribution()
const NAME_KEY = 'ai60_me_name'

type Modal = 'register' | 'ticket' | null
export type FormInput = Omit<RegisterInput, 'referredBy' | 'source' | 'campaign'>

interface AppState {
  mode: Store['mode']
  campaign: Campaign
  seats: Seat[]
  loaded: boolean
  error: string | null
  now: number
  me: Seat | null
  myName: string | null
  attribution: Attribution
  inviter: Seat | null
  refCounts: Map<string, number>
  modal: Modal
  justRegistered: boolean
  openRegister: () => void
  openTicket: () => void
  closeModal: () => void
  register: (input: FormInput) => Promise<RegisterResult>
  /** Registers someone else (e.g. a WhatsApp-bot conversation) without changing who "me" is. */
  registerOther: (input: RegisterInput) => Promise<RegisterResult>
  recover: (phone: string, email: string) => Promise<Seat | null>
  exportRows: (key: string) => Promise<PrivateSeat[]>
}

const Ctx = createContext<AppState | null>(null)

function readName(): string | null {
  try {
    return localStorage.getItem(NAME_KEY)
  } catch {
    return null
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [seats, setSeats] = useState<Seat[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [myCode, setCode] = useState<string | null>(getMyCode())
  const [myName, setName] = useState<string | null>(readName())
  const [modal, setModal] = useState<Modal>(null)
  const [justRegistered, setJustRegistered] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const next = await store.seats()
      setSeats(next)
      setNow(Date.now())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load seats')
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, store.mode === 'demo' ? 4000 : 15000)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const register = useCallback(
    async (input: FormInput) => {
      const result = await store.register({
        ...input,
        referredBy: initialAttribution.ref,
        source: initialAttribution.source,
        campaign: initialAttribution.campaign,
      })
      setMyCode(result.seat.code)
      setCode(result.seat.code)
      try {
        localStorage.setItem(NAME_KEY, input.name.trim())
      } catch {
        /* ignore */
      }
      setName(input.name.trim())
      setJustRegistered(!result.existing)
      await refresh()
      setModal('ticket')
      return result
    },
    [refresh],
  )

  const registerOther = useCallback(
    async (input: RegisterInput) => {
      const result = await store.register(input)
      await refresh()
      return result
    },
    [refresh],
  )

  const recover = useCallback(
    async (phone: string, email: string) => {
      const seat = await store.findTicket(phone, email)
      if (seat) {
        setMyCode(seat.code)
        setCode(seat.code)
        setJustRegistered(false)
        await refresh()
        setModal('ticket')
      }
      return seat
    },
    [refresh],
  )

  const value = useMemo<AppState>(() => {
    const me = myCode ? (seats.find((s) => s.code === myCode) ?? null) : null
    const inviter = initialAttribution.ref && initialAttribution.ref !== myCode ? (seats.find((s) => s.code === initialAttribution.ref) ?? null) : null
    return {
      mode: store.mode,
      campaign: store.campaign(),
      seats,
      loaded,
      error,
      now,
      me,
      myName,
      attribution: initialAttribution,
      inviter,
      refCounts: referralCounts(seats),
      modal,
      justRegistered,
      openRegister: () => setModal(me ? 'ticket' : 'register'),
      openTicket: () => setModal('ticket'),
      closeModal: () => {
        setModal(null)
        setJustRegistered(false)
      },
      register,
      registerOther,
      recover,
      exportRows: (key: string) => store.exportRows(key),
    }
  }, [seats, loaded, error, now, myCode, myName, modal, justRegistered, register, registerOther, recover])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
