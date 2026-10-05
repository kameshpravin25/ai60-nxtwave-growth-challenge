import type { Attendee, LiveEvent, RoomState } from './types'

export function emptyRoom(): RoomState {
  return {
    started: false,
    step: -1,
    stepAt: 0,
    attendees: new Map(),
    polls: new Map(),
    activePoll: null,
    questions: new Map(),
    quizzes: new Map(),
    activeQuiz: null,
    shipped: [],
    reactions: [],
    announcement: null,
    stuckLog: [],
  }
}

export const byTime = (a: LiveEvent, b: LiveEvent) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

function attendee(s: RoomState, e: LiveEvent): Attendee {
  let a = s.attendees.get(e.who)
  if (!a) {
    a = { who: e.who, name: 'Someone', college: '', branch: 'OTHER', gold: false, joinedAt: e.at, checks: new Map(), stuck: null, points: 0 }
    s.attendees.set(e.who, a)
  }
  return a
}

function clearStuck(s: RoomState, who: string, at: number) {
  const a = s.attendees.get(who)
  if (!a?.stuck) return
  a.stuck = null
  for (let i = s.stuckLog.length - 1; i >= 0; i--) {
    if (s.stuckLog[i].who === who && s.stuckLog[i].resolvedAt === null) {
      s.stuckLog[i].resolvedAt = at
      break
    }
  }
}

/** Rebuilds the whole room from its event log. Pure: same events in, same room out. */
export function reduce(events: LiveEvent[]): RoomState {
  const sorted = [...events].sort(byTime)
  let start = 0
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].kind === 'reset') {
      start = i + 1
      break
    }
  }

  const s = emptyRoom()
  for (let i = start; i < sorted.length; i++) {
    const e = sorted[i]
    switch (e.kind) {
      case 'join': {
        const a = attendee(s, e)
        Object.assign(a, { name: e.name, college: e.college, branch: e.branch, gold: e.gold })
        break
      }
      case 'check': {
        const a = attendee(s, e)
        if (!a.checks.has(e.milestone)) a.checks.set(e.milestone, e.at)
        clearStuck(s, e.who, e.at) // progress means they got unblocked
        break
      }
      case 'stuck': {
        const a = attendee(s, e)
        if (!a.stuck) {
          a.stuck = { step: e.step, note: e.note, at: e.at }
          s.stuckLog.push({ who: e.who, step: e.step, note: e.note, at: e.at, resolvedAt: null })
        }
        break
      }
      case 'unstuck':
        clearStuck(s, e.who, e.at)
        break
      case 'resolve':
        clearStuck(s, e.target, e.at)
        break
      case 'react':
        s.reactions.push({ emoji: e.emoji, at: e.at, who: e.who })
        break
      case 'vote': {
        const p = s.polls.get(e.poll)
        if (p?.open) p.votes.set(e.who, e.option)
        break
      }
      case 'ask':
        if (!s.questions.has(e.qid)) {
          s.questions.set(e.qid, { qid: e.qid, who: e.who, name: e.name, text: e.text, gold: e.gold, votes: new Set(), answered: false, at: e.at })
        }
        break
      case 'upvote': {
        const q = s.questions.get(e.qid)
        if (q && q.who !== e.who) q.votes.add(e.who)
        break
      }
      case 'answered': {
        const q = s.questions.get(e.qid)
        if (q) q.answered = true
        break
      }
      case 'ship': {
        const i = s.shipped.findIndex((x) => x.who === e.who)
        const entry = { who: e.who, name: e.name, college: e.college, url: e.url, project: e.project, score: e.score, at: e.at }
        if (i >= 0) s.shipped[i] = { ...s.shipped[i], ...entry, at: s.shipped[i].at }
        else s.shipped.push(entry)
        break
      }
      case 'answer': {
        const quiz = s.quizzes.get(e.quiz)
        if (!quiz || quiz.answers.has(e.who)) break
        const elapsed = e.at - quiz.at
        if (elapsed < 0 || elapsed > quiz.seconds * 1000) break
        const points = e.option === quiz.correct ? Math.round(1000 - 500 * (elapsed / (quiz.seconds * 1000))) : 0
        quiz.answers.set(e.who, { option: e.option, at: e.at, points })
        attendee(s, e).points += points
        break
      }
      case 'step':
        s.started = true
        s.step = e.step
        s.stepAt = e.at
        break
      case 'poll':
        if (s.activePoll) {
          const prev = s.polls.get(s.activePoll)
          if (prev) prev.open = false
        }
        s.polls.set(e.poll, { id: e.poll, q: e.q, options: e.options, votes: new Map(), open: true, at: e.at })
        s.activePoll = e.poll
        break
      case 'poll_close': {
        const p = s.polls.get(e.poll)
        if (p) p.open = false
        if (s.activePoll === e.poll) s.activePoll = null
        break
      }
      case 'quiz':
        s.quizzes.set(e.quiz, { id: e.quiz, q: e.q, options: e.options, correct: e.correct, seconds: e.seconds, at: e.at, answers: new Map() })
        s.activeQuiz = e.quiz
        break
      case 'announce':
        s.announcement = e.text ? { text: e.text, at: e.at } : null
        break
      case 'reset':
        break
    }
  }
  if (s.reactions.length > 150) s.reactions = s.reactions.slice(-150)
  return s
}

/** Funnel counts in milestone order (joined → … → submitted). */
export function funnel(s: RoomState) {
  const list = [...s.attendees.values()]
  return {
    joined: list.length,
    key: list.filter((a) => a.checks.has('key')).length,
    call: list.filter((a) => a.checks.has('call')).length,
    ui: list.filter((a) => a.checks.has('ui')).length,
    deploy: list.filter((a) => a.checks.has('deploy')).length,
    submit: list.filter((a) => a.checks.has('submit')).length,
  }
}

/** Gold-batch (3+ referrals) questions get a priority boost, as promised on the landing page. */
export const questionRank = (q: { votes: Set<string>; gold: boolean }) => q.votes.size + (q.gold ? 5 : 0)

export function leaderboard(s: RoomState, limit = 5) {
  return [...s.attendees.values()]
    .filter((a) => a.points > 0)
    .sort((a, b) => b.points - a.points || a.joinedAt - b.joinedAt)
    .slice(0, limit)
}
