import type { Branch } from '../../types'

export type Milestone = 'key' | 'call' | 'ui' | 'deploy' | 'submit'

export const MILESTONES: Array<{ key: Milestone; label: string; step: number }> = [
  { key: 'key', label: 'Got my Gemini API key', step: 0 },
  { key: 'call', label: 'First AI response', step: 2 },
  { key: 'ui', label: 'App UI working', step: 2 },
  { key: 'deploy', label: 'Deployed live', step: 3 },
  { key: 'submit', label: 'Submitted for evaluation', step: 4 },
]

export const REACTIONS = ['🔥', '👏', '🤯', '😂', '🙏'] as const

/** Who sent the event: a ticket code, a guest id, or "host". */
interface Base {
  id: string
  at: number
  who: string
}

export type AttendeeEvent =
  | { kind: 'join'; name: string; college: string; branch: Branch; gold: boolean }
  | { kind: 'check'; milestone: Milestone }
  | { kind: 'stuck'; step: number; note: string }
  | { kind: 'unstuck' }
  | { kind: 'react'; emoji: string }
  | { kind: 'vote'; poll: string; option: number }
  | { kind: 'ask'; qid: string; text: string; name: string; gold: boolean }
  | { kind: 'upvote'; qid: string }
  | { kind: 'ship'; url: string; project: string; name: string; college: string; score?: number }
  | { kind: 'answer'; quiz: string; option: number }

export type HostEvent =
  | { kind: 'step'; step: number }
  | { kind: 'poll'; poll: string; q: string; options: string[] }
  | { kind: 'poll_close'; poll: string }
  | { kind: 'quiz'; quiz: string; q: string; options: string[]; correct: number; seconds: number }
  | { kind: 'answered'; qid: string }
  | { kind: 'resolve'; target: string }
  | { kind: 'announce'; text: string }
  | { kind: 'reset' }

export type LiveEvent = Base & (AttendeeEvent | HostEvent)
export type EventInput = AttendeeEvent | HostEvent

export interface Attendee {
  who: string
  name: string
  college: string
  branch: Branch
  gold: boolean
  joinedAt: number
  checks: Map<Milestone, number>
  stuck: { step: number; note: string; at: number } | null
  points: number
}

export interface Poll {
  id: string
  q: string
  options: string[]
  votes: Map<string, number>
  open: boolean
  at: number
}

export interface Question {
  qid: string
  who: string
  name: string
  text: string
  gold: boolean
  votes: Set<string>
  answered: boolean
  at: number
}

export interface Quiz {
  id: string
  q: string
  options: string[]
  correct: number
  seconds: number
  at: number
  answers: Map<string, { option: number; at: number; points: number }>
}

export interface Shipped {
  who: string
  name: string
  college: string
  url: string
  project: string
  score?: number
  at: number
}

export interface RoomState {
  started: boolean
  step: number
  stepAt: number
  attendees: Map<string, Attendee>
  polls: Map<string, Poll>
  activePoll: string | null
  questions: Map<string, Question>
  quizzes: Map<string, Quiz>
  activeQuiz: string | null
  shipped: Shipped[]
  reactions: Array<{ emoji: string; at: number; who: string }>
  announcement: { text: string; at: number } | null
  /** Every stuck episode, for "where do people get stuck" analysis. */
  stuckLog: Array<{ who: string; step: number; note: string; at: number; resolvedAt: number | null }>
}
