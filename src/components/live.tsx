import { useEffect, useRef, useState } from 'react'
import type { Poll, Quiz, RoomState } from '../lib/live/types'
import { AGENDA } from '../data/agenda'
import { pad } from '../lib/time'

export function PollResults({ poll, mine }: { poll: Poll; mine?: number }) {
  const counts = poll.options.map((_, i) => [...poll.votes.values()].filter((v) => v === i).length)
  const total = counts.reduce((s, c) => s + c, 0)
  const max = Math.max(1, ...counts)
  return (
    <ul className="poll-results" aria-label={`Results: ${total} votes`}>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((counts[i] / total) * 100) : 0
        return (
          <li key={o} className={i === mine ? 'mine' : ''}>
            <span className="pr-label">
              {o}
              {i === mine && <small> · you</small>}
            </span>
            <span className="pr-track">
              <span className="pr-bar" style={{ width: `${(counts[i] / max) * 100}%` }} />
            </span>
            <span className="pr-val">
              {pct}% <small>({counts[i]})</small>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function quizRemaining(quiz: Quiz, now: number) {
  return Math.max(0, quiz.at + quiz.seconds * 1000 - now)
}

export function QuizTimer({ quiz, now }: { quiz: Quiz; now: number }) {
  const left = quizRemaining(quiz, now)
  return (
    <div className="quiz-timer" role="timer" aria-label={`${Math.ceil(left / 1000)} seconds left`}>
      <span className="qt-bar" style={{ width: `${(left / (quiz.seconds * 1000)) * 100}%` }} />
      <b className="mono">{Math.ceil(left / 1000)}s</b>
    </div>
  )
}

/** Emoji reactions from everyone in the room float up the screen for a few seconds. */
export function ReactionLayer({ room, now }: { room: RoomState; now: number }) {
  const [seenAt] = useState(() => Date.now() - 3000)
  const live = room.reactions.filter((r) => r.at > seenAt && now - r.at < 4000).slice(-18)
  return (
    <div className="reaction-layer" aria-hidden>
      {live.map((r) => {
        const x = (parseInt(String(r.at).slice(-3), 10) * 7 + r.who.charCodeAt(r.who.length - 1) * 13) % 90
        return (
          <span key={`${r.who}${r.at}`} className="float-emoji" style={{ left: `${5 + x}%` }}>
            {r.emoji}
          </span>
        )
      })}
    </div>
  )
}

export function StepTrack({ room, now }: { room: RoomState; now: number }) {
  const inStep = room.started ? Math.max(0, Math.floor((now - room.stepAt) / 1000)) : 0
  return (
    <div className="step-track">
      <ol>
        {AGENDA.map((s, i) => (
          <li key={s.title} className={i < room.step ? 'done' : i === room.step ? 'now' : ''}>
            <span className="mono">{pad(s.at)}:00</span>
            <b>{s.title}</b>
          </li>
        ))}
      </ol>
      <span className="mono step-clock" title="Time in this step">
        {room.started ? `${pad(Math.floor(inStep / 60))}:${pad(inStep % 60)}` : '--:--'}
      </span>
    </div>
  )
}

/** Remembers which IDs were already shown, so new arrivals can animate in. */
export function useFresh(ids: string[]): Set<string> {
  const seen = useRef<Set<string> | null>(null)
  const fresh = new Set<string>()
  if (seen.current) for (const id of ids) if (!seen.current.has(id)) fresh.add(id)
  useEffect(() => {
    seen.current = new Set(ids)
  })
  return fresh
}
