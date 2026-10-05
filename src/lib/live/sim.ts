/**
 * DEMO MODE ONLY. Simulated attendees for the live workshop room.
 *
 * Bots are drawn from the registered seats (≈42% show-up, the plan's attendance assumption) and their
 * behaviour is a pure function of (host events, time). Every tab computes the same room with no
 * coordination, and a bot reacts to whatever the host does: advancing steps, opening polls, launching
 * quizzes, resolving stuck students. Timings are compressed so a 60-minute session plays out in minutes.
 */
import type { Seat } from '../../types'
import { BRANCHES } from '../../data/branches'
import type { HostEvent, LiveEvent, Milestone } from './types'

const SEC = 1000

function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
const r01 = (key: string) => hash(key) / 4294967296

/* ---------------- Autopilot: a scripted host for unattended demos ---------------- */

export const POLL_TEMPLATES = [
  { id: 'branch', q: 'Which branch are you from?', options: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'Other'] },
  { id: 'api', q: 'Have you ever called an AI API from code?', options: ['Never', 'Once or twice', 'Yes, regularly'] },
  { id: 'pace', q: 'How is the pace right now?', options: ['Too fast', 'Just right', 'Too slow'] },
  { id: 'nps', q: 'How likely are you to recommend AI60 to a batchmate?', options: ['0–6', '7–8', '9–10'] },
]

export const QUIZ_TEMPLATES = [
  { id: 'q1', q: 'What does the system prompt do?', options: ["Sets the model's role and rules", 'Stores your API key', 'Makes the app faster', 'Deploys the app'], correct: 0, seconds: 15 },
  { id: 'q2', q: 'Where should your API key live on Hugging Face?', options: ['Inside app.py', 'In a Space Secret', 'In README.md', 'In the URL'], correct: 1, seconds: 15 },
  { id: 'q3', q: 'SiteEstimate lets the LLM extract numbers but Python does the maths. Why?', options: ['Python is cheaper', 'LLMs can make arithmetic mistakes', "Gemini can't read numbers", 'Gradio requires it'], correct: 1, seconds: 15 },
]

export const ANNOUNCEMENTS = [
  "💡 Seeing 'API key not valid'? Regenerate the key in AI Studio and paste it again, with no spaces.",
  '🚀 Deploy: New Space → Gradio → upload app.py + requirements.txt → Settings → Secrets → GEMINI_API_KEY',
  "🐢 Space stuck on 'Building'? First builds take 2–3 minutes. Refresh once, then raise your hand.",
]

const poll = (id: string): HostEvent => {
  const t = POLL_TEMPLATES.find((p) => p.id === id)!
  return { kind: 'poll', poll: t.id, q: t.q, options: t.options }
}
const quiz = (id: string): HostEvent => {
  const t = QUIZ_TEMPLATES.find((q) => q.id === id)!
  return { kind: 'quiz', quiz: t.id, q: t.q, options: t.options, correct: t.correct, seconds: t.seconds }
}

const SCRIPT: Array<[number, HostEvent]> = [
  [0, { kind: 'step', step: 0 }],
  [6, poll('branch')],
  [38, { kind: 'poll_close', poll: 'branch' }],
  [42, { kind: 'step', step: 1 }],
  [50, poll('api')],
  [80, { kind: 'poll_close', poll: 'api' }],
  [84, { kind: 'step', step: 2 }],
  [96, { kind: 'announce', text: ANNOUNCEMENTS[0] }],
  [150, poll('pace')],
  [185, { kind: 'poll_close', poll: 'pace' }],
  [190, { kind: 'step', step: 3 }],
  [194, { kind: 'announce', text: ANNOUNCEMENTS[1] }],
  [262, { kind: 'step', step: 4 }],
  [266, { kind: 'announce', text: '' }],
  [272, quiz('q1')],
  [292, quiz('q2')],
  [312, quiz('q3')],
  [335, poll('nps')],
]

export const AUTOPILOT_SECONDS = SCRIPT[SCRIPT.length - 1][0]

export function autopilotEvents(start: number, now: number): LiveEvent[] {
  const out: LiveEvent[] = []
  SCRIPT.forEach(([sec, e], i) => {
    const at = start + sec * SEC
    if (at <= now) out.push({ ...e, id: `ap:${start}:${String(i).padStart(3, '0')}`, at, who: 'host' } as LiveEvent)
  })
  return out
}

/* ---------------- Bots ---------------- */

const STUCK_NOTES: Record<'key' | 'call' | 'deploy', string[]> = {
  key: ['API key not valid. Please pass a valid API key.', "Can't find where to create the key", 'AI Studio keeps asking me to sign in'],
  call: ["ModuleNotFoundError: No module named 'google.genai'", '429 RESOURCE_EXHAUSTED', "KeyError: 'GEMINI_API_KEY'", 'The output is empty'],
  deploy: ["Space stuck on 'Building'", 'Runtime error: GEMINI_API_KEY not found', 'requirements.txt install failed', 'Works locally but not on Hugging Face'],
}

const BOT_QUESTIONS = [
  { step: 0, text: 'Is the Gemini API free for students? Do I need a credit card?' },
  { step: 1, text: 'How is this different from just using ChatGPT?' },
  { step: 2, text: 'Can I use OpenAI or Claude instead of Gemini?' },
  { step: 2, text: 'How do I keep my API key safe when I push to GitHub?' },
  { step: 3, text: "My Space has said 'Building' for 5 minutes. Is that normal?" },
  { step: 4, text: 'Can I list this on my resume if I built it in a workshop?' },
  { step: 4, text: 'Will the recording be shared? I want to rebuild it for my final-year project.' },
]

const STEP_EMOJI = ['🙏', '🤯', '🔥', '👏', '👏']

interface BotInput {
  hostEvents: LiveEvent[]
  roster: Seat[]
  refCounts: Map<string, number>
  exclude?: string | null
  now: number
}

export function simulateBots({ hostEvents, roster, refCounts, exclude, now }: BotInput): LiveEvent[] {
  const host = [...hostEvents].sort((a, b) => a.at - b.at)
  const lastReset = host.map((e) => e.kind).lastIndexOf('reset')
  const session = lastReset >= 0 ? host.slice(lastReset + 1) : host
  if (!session.length) return []
  const start = session[0].at

  // When was each step first reached? (Jumping from 0 to 2 reaches 1 at the same moment.)
  const reached: Array<number | undefined> = []
  for (const e of session) {
    if (e.kind !== 'step') continue
    for (let s = 0; s <= e.step; s++) reached[s] ??= e.at
  }
  const resolves = new Map<string, number[]>()
  for (const e of session) if (e.kind === 'resolve') resolves.set(e.target, [...(resolves.get(e.target) ?? []), e.at])

  const bots = roster
    .filter((s) => s.code !== exclude && hash(`show:${s.code}`) % 100 < 42)
    .slice(0, 140)

  const out: LiveEvent[] = []
  const emit = (e: LiveEvent) => {
    if (e.at <= now) out.push(e)
  }

  const joinedAt = new Map<string, number>()
  bots.forEach((b) => {
    const r = (k: string) => r01(`${b.code}:${k}`)
    const joinAt = start + (-25 + r('join') * 110) * SEC
    joinedAt.set(b.code, joinAt)
    const gold = (refCounts.get(b.code) ?? 0) >= 3
    const project = BRANCHES.find((x) => x.branch === b.branch)?.project ?? 'RecordWriter'
    emit({ id: `b:${b.code}:join`, at: joinAt, who: b.code, kind: 'join', name: b.name, college: b.college, branch: b.branch, gold })

    const speed = 0.55 + r('speed') * 0.9
    const skill = r('skill')
    const prone = r('prone')

    let prev = joinAt
    let alive = true
    const plan: Array<{ m: Milestone; step: number; delay: number; p: number; stuck?: 'key' | 'call' | 'deploy'; stuckP: number }> = [
      { m: 'key', step: 0, delay: 8 + 36 * speed * r('d:key'), p: 0.96, stuck: 'key', stuckP: 0.1 },
      { m: 'call', step: 2, delay: 14 + 40 * speed * r('d:call'), p: 0.76 + 0.2 * skill, stuck: 'call', stuckP: 0.18 },
      { m: 'ui', step: 2, delay: 26 + 50 * speed * r('d:ui'), p: 0.62 + 0.3 * skill, stuckP: 0 },
      { m: 'deploy', step: 3, delay: 12 + 44 * speed * r('d:deploy'), p: 0.58 + 0.35 * skill, stuck: 'deploy', stuckP: 0.22 },
      { m: 'submit', step: 4, delay: 8 + 30 * speed * r('d:submit'), p: 0.62 + 0.3 * skill, stuckP: 0 },
    ]
    for (const step of plan) {
      const begin = reached[step.step]
      if (!alive || begin === undefined) break
      let doneAt = Math.max(begin + step.delay * SEC, prev + 4 * SEC)

      if (step.stuck && r(`stuck:${step.m}`) < step.stuckP * (0.4 + prone * 1.4)) {
        const stuckAt = Math.max(begin, prev) + step.delay * 0.4 * SEC
        const notes = STUCK_NOTES[step.stuck]
        const selfFix = stuckAt + (25 + r(`fix:${step.m}`) * 85) * SEC
        const hostFix = (resolves.get(b.code) ?? []).find((t) => t > stuckAt) ?? Infinity
        const fixedBy = Math.min(selfFix, hostFix)
        emit({ id: `b:${b.code}:stuck:${step.m}`, at: stuckAt, who: b.code, kind: 'stuck', step: step.step, note: notes[hash(`${b.code}${step.m}`) % notes.length] })
        if (fixedBy === selfFix) emit({ id: `b:${b.code}:unstuck:${step.m}`, at: selfFix, who: b.code, kind: 'unstuck' })
        doneAt = Math.max(doneAt, fixedBy + 6 * SEC)
      }

      if (r(`p:${step.m}`) > step.p) {
        alive = false
        break
      }
      emit({ id: `b:${b.code}:check:${step.m}`, at: doneAt, who: b.code, kind: 'check', milestone: step.m })
      if (step.m === 'deploy') {
        const handle = b.name.toLowerCase().replace(/[^a-z]/g, '') + b.code.slice(5, 7).toLowerCase()
        emit({ id: `b:${b.code}:ship`, at: doneAt + SEC, who: b.code, kind: 'ship', url: `https://huggingface.co/spaces/${handle}/${project.toLowerCase()}`, project, name: b.name, college: b.college })
        if (r('react:deploy') < 0.3) emit({ id: `b:${b.code}:react:deploy`, at: doneAt + 2 * SEC, who: b.code, kind: 'react', emoji: '🔥' })
      }
      if (step.m === 'submit') {
        const handle = b.name.toLowerCase().replace(/[^a-z]/g, '') + b.code.slice(5, 7).toLowerCase()
        const score = Math.round(55 + skill * 38 + r('score') * 6)
        emit({ id: `b:${b.code}:ship:scored`, at: doneAt + SEC, who: b.code, kind: 'ship', url: `https://huggingface.co/spaces/${handle}/${project.toLowerCase()}`, project, name: b.name, college: b.college, score })
      }
      prev = doneAt
    }

    // Reactions when the host moves on
    reached.forEach((at, s) => {
      if (at !== undefined && at > joinAt && r(`react:${s}`) < 0.32) {
        emit({ id: `b:${b.code}:react:step${s}`, at: at + r(`rt:${s}`) * 9 * SEC, who: b.code, kind: 'react', emoji: STEP_EMOJI[s] })
      }
    })
  })

  // Polls and quizzes
  for (const e of session) {
    if (e.kind === 'poll') {
      const close = session.find((x) => x.kind === 'poll_close' && x.poll === e.poll && x.at > e.at)?.at ?? Infinity
      const weights = e.options.map((_, i) => 0.3 + r01(`${e.poll}:w:${i}`))
      for (const b of bots) {
        const r = (k: string) => r01(`${b.code}:${e.poll}:${k}`)
        if (joinedAt.get(b.code)! > e.at + 20 * SEC || r('votes') > 0.82) continue
        const at = e.at + (3 + r('t') * 22) * SEC
        if (at >= close) continue
        const branchIdx = e.options.findIndex((o) => o.toUpperCase() === (b.branch === 'OTHER' ? 'OTHER' : b.branch))
        let option = branchIdx
        if (option < 0) {
          let pick = r('pick') * weights.reduce((s, w) => s + w, 0)
          option = weights.findIndex((w) => (pick -= w) <= 0)
        }
        emit({ id: `b:${b.code}:vote:${e.poll}:${e.at}`, at, who: b.code, kind: 'vote', poll: e.poll, option: Math.max(0, option) })
      }
    }
    if (e.kind === 'quiz') {
      for (const b of bots) {
        const r = (k: string) => r01(`${b.code}:${e.quiz}:${e.at}:${k}`)
        if (joinedAt.get(b.code)! > e.at || r('answers') > 0.88) continue
        const skill = r01(`${b.code}:skill`)
        const correct = r('right') < 0.35 + 0.55 * skill
        const wrong = [...e.options.keys()].filter((i) => i !== e.correct)
        emit({
          id: `b:${b.code}:answer:${e.quiz}:${e.at}`,
          at: e.at + (1.5 + r('t') * (e.seconds - 3)) * SEC,
          who: b.code,
          kind: 'answer',
          quiz: e.quiz,
          option: correct ? e.correct : wrong[Math.floor(r('w') * wrong.length)],
        })
      }
    }
  }

  // Questions from the floor, upvoted over time
  BOT_QUESTIONS.forEach((q, i) => {
    const begin = reached[q.step]
    if (begin === undefined || !bots.length) return
    const asker = bots[(i * 37 + 11) % bots.length]
    const askAt = begin + (16 + i * 6) * SEC
    const qid = `bq${i}`
    emit({ id: `b:${asker.code}:ask:${qid}`, at: askAt, who: asker.code, kind: 'ask', qid, text: q.text, name: asker.name, gold: (refCounts.get(asker.code) ?? 0) >= 3 })
    const popularity = 0.06 + r01(`pop:${qid}`) * 0.28
    for (const b of bots) {
      if (b.code === asker.code || r01(`${b.code}:up:${qid}`) > popularity) continue
      emit({ id: `b:${b.code}:upvote:${qid}`, at: askAt + (4 + r01(`${b.code}:upt:${qid}`) * 70) * SEC, who: b.code, kind: 'upvote', qid })
    }
  })

  return out
}
