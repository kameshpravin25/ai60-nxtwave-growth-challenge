/**
 * AI60 WhatsApp bot: a pure state machine, shared by the in-browser simulator (/whatsapp) and the
 * WhatsApp Cloud API webhook (api/whatsapp.ts). Respects WhatsApp's interactive-message limits
 * (≤3 reply buttons, titles ≤20 chars, ≤10 list rows) and the STOP opt-out.
 *
 * No Vite-only imports here: this file also runs inside a serverless function.
 */
import { COLLEGES, canonicalCollege } from '../../data/colleges.js'

export type WaNode =
  | 'start'
  | 'menu'
  | 'about'
  | 'name'
  | 'college'
  | 'branch'
  | 'year'
  | 'email'
  | 'confirm'
  | 'registered'
  | 'submit_url'
  | 'submit_desc'
  | 'human'
  | 'stopped'

export interface WaSession {
  node: WaNode
  data: { name?: string; college?: string; branch?: string; year?: number; email?: string; url?: string }
  ticket?: { seat: number; code: string; name: string }
  optedOut?: boolean
  visited: WaNode[]
}

export type WaIn = { type: 'text'; text: string } | { type: 'reply'; id: string; title?: string }

export type WaOut =
  | { type: 'text'; text: string }
  | { type: 'buttons'; text: string; buttons: Array<{ id: string; title: string }> }
  | { type: 'list'; text: string; button: string; rows: Array<{ id: string; title: string; description?: string }> }
  | { type: 'ticket'; seat: number; code: string; name: string; caption: string }
  | { type: 'cta'; text: string; label: string; url: string }

export interface WaDeps {
  phone: string
  siteUrl: string
  workshopLabel: string
  calendarUrl: string
  register(input: { name: string; email: string; phone: string; college: string; branch: string; gradYear: number }): Promise<{ seat: number; code: string; name: string; existing: boolean }>
  evaluate?(input: { url: string; description: string; name: string; college: string; branch: string; code: string }): Promise<{ total: number; pass: boolean; reasons: string[]; fixes: string[]; certificateUrl: string | null }>
}

/** Nodes in display order, for the simulator's flow map. */
export const FLOW_MAP: Array<{ id: WaNode; label: string; lane: 'entry' | 'register' | 'after' | 'submit' | 'support' }> = [
  { id: 'start', label: 'Hi / AI60 keyword', lane: 'entry' },
  { id: 'menu', label: 'Menu (3 buttons)', lane: 'entry' },
  { id: 'about', label: 'What is AI60?', lane: 'entry' },
  { id: 'name', label: 'Name', lane: 'register' },
  { id: 'college', label: 'College (list)', lane: 'register' },
  { id: 'branch', label: 'Branch (list)', lane: 'register' },
  { id: 'year', label: 'Year (buttons)', lane: 'register' },
  { id: 'email', label: 'Email', lane: 'register' },
  { id: 'confirm', label: 'Confirm', lane: 'register' },
  { id: 'registered', label: 'Hall ticket + invite', lane: 'after' },
  { id: 'submit_url', label: 'Project URL', lane: 'submit' },
  { id: 'submit_desc', label: 'One-line pitch → evaluate', lane: 'submit' },
  { id: 'human', label: 'Human handoff', lane: 'support' },
  { id: 'stopped', label: 'STOP (opt-out)', lane: 'support' },
]

export const newSession = (): WaSession => ({ node: 'start', data: {}, visited: [] })

const BRANCH_ROWS = [
  { id: 'b:CSE', title: 'CSE' },
  { id: 'b:IT', title: 'IT' },
  { id: 'b:ECE', title: 'ECE' },
  { id: 'b:EEE', title: 'EEE' },
  { id: 'b:MECH', title: 'Mechanical' },
  { id: 'b:CIVIL', title: 'Civil' },
  { id: 'b:OTHER', title: 'Other branch' },
]

const COLLEGE_ROWS = [
  ...COLLEGES.slice(0, 9).map((c, i) => ({ id: `c:${i}`, title: c.slice(0, 24) })),
  { id: 'c:other', title: 'Other (type it)', description: 'Type your college name' },
]

const say = (text: string): WaOut => ({ type: 'text', text })

function menu(s: WaSession, lead?: string): WaOut {
  const text = lead ?? `👋 Hi! I'm the *AI60* bot from NxtWave.\n\n*Build Your First AI Project in 60 Minutes*, a free live workshop for engineers from any branch.`
  return s.ticket
    ? { type: 'buttons', text: `${text}\n\nYou're in: seat *#${s.ticket.seat}*.`, buttons: [{ id: 'ticket', title: '🎟 My hall ticket' }, { id: 'invite', title: '👥 Invite my batch' }, { id: 'submit', title: '📤 Submit project' }] }
    : { type: 'buttons', text, buttons: [{ id: 'register', title: '🎟 Get hall ticket' }, { id: 'about', title: '❓ What is AI60?' }, { id: 'submit', title: '📤 Submit project' }] }
}

function inviteText(s: WaSession, deps: WaDeps): string {
  const link = `${deps.siteUrl}/?ref=${s.ticket?.code ?? ''}`
  return `Got my hall ticket 🎟️ for a FREE live workshop: *Build Your First AI Project in 60 Minutes*.\n\nAny branch, no AI background needed. We build AND deploy a real AI project + certificate.\n\nI'm seat #${s.ticket?.seat}. Claim the seat next to mine 👇\n${link}`
}

function ticketReplies(s: WaSession, deps: WaDeps, existing: boolean): WaOut[] {
  const t = s.ticket!
  return [
    { type: 'ticket', seat: t.seat, code: t.code, name: t.name, caption: `🎟 *Hall ticket · Seat #${t.seat}*\nRoll no. ${t.code} · ${deps.workshopLabel}` },
    {
      type: 'buttons',
      text: `${existing ? 'You already have a seat, so here it is again.' : '✅ *Seat allotted!*'}\n\nYour project batch is already 4 people. When *3 batchmates* register with your link, your ticket turns *gold* and your batch gets priority Q&A.`,
      buttons: [
        { id: 'invite', title: '👥 Invite my batch' },
        { id: 'calendar', title: '📅 Add to calendar' },
        { id: 'menu', title: '🏠 Menu' },
      ],
    },
  ]
}

const visit = (s: WaSession, node: WaNode): WaSession => ({ ...s, node, visited: s.visited.includes(node) ? s.visited : [...s.visited, node] })

export async function step(session: WaSession, input: WaIn, deps: WaDeps): Promise<{ session: WaSession; replies: WaOut[] }> {
  const text = input.type === 'text' ? input.text.trim() : ''
  const id = input.type === 'reply' ? input.id : ''
  const word = text.toLowerCase()
  let s = session

  // Opt-out is absolute: after STOP we stay silent until START.
  if (/^(stop|unsubscribe)$/i.test(text)) {
    s = visit({ ...s, optedOut: true }, 'stopped')
    return { session: s, replies: [say("You're unsubscribed. AI60 won't message you again. Reply *START* any time to come back.")] }
  }
  if (s.optedOut) {
    if (/^start$/i.test(text)) {
      s = visit({ ...s, optedOut: false }, 'menu')
      return { session: s, replies: [menu(s, '👋 Welcome back!')] }
    }
    return { session: s, replies: [] }
  }

  // Global shortcuts
  if (id === 'menu' || /^(hi|hello|hey|menu|ai60|start)\b/.test(word)) {
    s = visit(s, 'menu')
    return { session: s, replies: [menu(s)] }
  }
  if (id === 'human' || /^(help|human|agent|mentor)\b/.test(word)) {
    s = visit(s, 'human')
    return { session: s, replies: [say('🙋 A mentor will reply in this chat within 2 hours (9 am to 9 pm). Meanwhile, the FAQ answers most questions: ' + `${deps.siteUrl}/#viva`)] }
  }
  if (id === 'about') {
    s = visit(s, 'about')
    return {
      session: s,
      replies: [
        {
          type: 'buttons',
          text: `*AI60* · ${deps.workshopLabel}\n\nIn 60 minutes you build an AI app *for your branch* (ResumeRadar for CSE, BillBot for EEE, SiteEstimate for Civil…), deploy it to a live URL and get a certificate.\n\n✓ Free · ✓ Browser only · ✓ No AI background needed`,
          buttons: [
            { id: 'register', title: '🎟 Get hall ticket' },
            { id: 'human', title: '🙋 Ask a human' },
          ],
        },
      ],
    }
  }
  if (id === 'ticket' && s.ticket) return { session: s, replies: ticketReplies(s, deps, true) }
  if (id === 'invite' && s.ticket) {
    return { session: s, replies: [say('Forward this to your batch 👇'), say(inviteText(s, deps))] }
  }
  if (id === 'calendar') {
    return { session: s, replies: [{ type: 'cta', text: `📅 ${deps.workshopLabel}. Add it so you don't miss it.`, label: 'Add to calendar', url: deps.calendarUrl }] }
  }
  if (id === 'ready') return { session: s, replies: [say('🙌 See you there! Keep your Gemini key handy.')] }
  if (id === 'cant') return { session: s, replies: [say("No worries. You'll get the recording, and you can still submit a project within 48 hours for the certificate.")] }

  if (id === 'register' || id === 'restart') {
    if (s.ticket && id === 'register') return { session: s, replies: ticketReplies(s, deps, true) }
    s = visit({ ...s, data: {} }, 'name')
    return { session: s, replies: [say("Let's get your hall ticket 🎟 (5 quick questions).\n\nWhat's your *full name*, as it should appear on the ticket?")] }
  }
  if (id === 'submit') {
    if (!s.ticket) {
      s = visit({ ...s, data: {} }, 'name')
      return { session: s, replies: [say("You'll need a hall ticket first, so let's do that (5 quick questions).\n\nWhat's your *full name*?")] }
    }
    s = visit(s, 'submit_url')
    return { session: s, replies: [say('📤 Send the *live URL* of your app (e.g. https://huggingface.co/spaces/you/resumeradar).')] }
  }

  switch (s.node) {
    case 'name': {
      if (!/^[\p{L} .'-]{2,60}$/u.test(text)) return { session: s, replies: [say('Please send just your name, e.g. *Ananya Reddy*.')] }
      s = visit({ ...s, data: { ...s.data, name: text.replace(/\s+/g, ' ') } }, 'college')
      return { session: s, replies: [{ type: 'list', text: `Nice to meet you, ${text.split(' ')[0]}! Which *college* are you from?`, button: 'Choose college', rows: COLLEGE_ROWS }] }
    }
    case 'college': {
      if (id === 'c:other') return { session: s, replies: [say('Type your college name.')] }
      const college = id.startsWith('c:') ? COLLEGES[Number(id.slice(2))] : text.length >= 2 ? canonicalCollege(text) : ''
      if (!college) return { session: s, replies: [say('Type your college name, or pick one from the list.')] }
      s = visit({ ...s, data: { ...s.data, college } }, 'branch')
      return { session: s, replies: [{ type: 'list', text: 'Your *branch*? (Every branch gets its own project.)', button: 'Choose branch', rows: BRANCH_ROWS }] }
    }
    case 'branch': {
      const typed = BRANCH_ROWS.find((b) => b.title.toLowerCase() === word || b.id.slice(2).toLowerCase() === word)
      const branch = id.startsWith('b:') ? id.slice(2) : typed?.id.slice(2)
      if (!branch) return { session: s, replies: [{ type: 'list', text: 'Pick your branch from the list 👇', button: 'Choose branch', rows: BRANCH_ROWS }] }
      s = visit({ ...s, data: { ...s.data, branch } }, 'year')
      return {
        session: s,
        replies: [
          {
            type: 'buttons',
            text: 'When do you graduate?',
            buttons: [
              { id: 'y:2027', title: '2027 (final year)' },
              { id: 'y:2028', title: '2028 (pre-final)' },
              { id: 'y:2026', title: 'Other year' },
            ],
          },
        ],
      }
    }
    case 'year': {
      const year = id.startsWith('y:') ? Number(id.slice(2)) : /20\d\d/.test(text) ? Number(text.match(/20\d\d/)![0]) : 0
      if (!year) return { session: s, replies: [say('Tap one of the buttons above, or type your graduation year (e.g. 2027).')] }
      s = visit({ ...s, data: { ...s.data, year } }, 'email')
      return { session: s, replies: [say('Last one: your *email*? (The certificate goes there.)')] }
    }
    case 'email': {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) return { session: s, replies: [say("That doesn't look like an email. Try again?")] }
      s = visit({ ...s, data: { ...s.data, email: text.toLowerCase() } }, 'confirm')
      const d = s.data
      return {
        session: s,
        replies: [
          {
            type: 'buttons',
            text: `Please confirm:\n\n👤 ${d.name}\n🏫 ${d.college}\n🛠 ${d.branch} · Class of ${d.year}\n✉️ ${d.email}`,
            buttons: [
              { id: 'confirm', title: '✅ Confirm' },
              { id: 'restart', title: '✏️ Start over' },
            ],
          },
        ],
      }
    }
    case 'confirm': {
      if (id !== 'confirm' && !/^(yes|y|confirm|ok)$/i.test(text)) return { session: s, replies: [say('Tap *Confirm*, or *Start over* to fix something.')] }
      const d = s.data
      const result = await deps.register({ name: d.name!, email: d.email!, phone: deps.phone, college: d.college!, branch: d.branch!, gradYear: d.year! })
      s = visit({ ...s, ticket: { seat: result.seat, code: result.code, name: result.name } }, 'registered')
      return { session: s, replies: ticketReplies(s, deps, result.existing) }
    }
    case 'submit_url': {
      let ok = false
      try {
        ok = /^https?:$/.test(new URL(text).protocol)
      } catch {
        ok = false
      }
      if (!ok) return { session: s, replies: [say('Send the full link, starting with https://')] }
      s = visit({ ...s, data: { ...s.data, url: text } }, 'submit_desc')
      return { session: s, replies: [say("Got it. In 1–2 sentences: *who does it help, and what does it do?* (Like you'd say in an interview.)")] }
    }
    case 'submit_desc': {
      if (text.length < 20) return { session: s, replies: [say('A little more detail please (at least one full sentence).')] }
      if (!deps.evaluate) return { session: s, replies: [say('The evaluator is offline right now. Submit on the website instead: ' + `${deps.siteUrl}/submit`)] }
      const r = await deps.evaluate({ url: s.data.url!, description: text, name: s.data.name ?? s.ticket!.name, college: s.data.college ?? '', branch: s.data.branch ?? '', code: s.ticket!.code })
      s = visit(s, 'menu')
      const out: WaOut[] = [
        say(
          r.pass
            ? `🎉 *${r.total}/100: passed!*\n\nTop tip: ${r.fixes[0] ?? 'Keep building!'}`
            : `*${r.total}/100: not yet.*\n\n${r.reasons.map((x) => `• ${x}`).join('\n')}\n\nFix it and send *Submit project* again.`,
        ),
      ]
      if (r.certificateUrl) out.push({ type: 'cta', text: 'Your certificate is ready. Recruiters can verify it with one tap.', label: 'View certificate', url: r.certificateUrl })
      return { session: s, replies: out }
    }
    default: {
      s = visit(s, 'menu')
      return { session: s, replies: s.node === 'menu' && session.node !== 'start' ? [menu(s, "Sorry, I didn't get that. Pick an option 👇")] : [menu(s)] }
    }
  }
}

/** Pre-approved template messages, sent outside the 24-hour window on a schedule. */
export function scheduled(kind: 'nudge' | 't24' | 't1' | 'post', s: WaSession, deps: WaDeps, seatsLeft: number): WaOut[] {
  const first = (s.ticket?.name ?? s.data.name ?? 'there').split(' ')[0]
  switch (kind) {
    case 'nudge':
      return [
        {
          type: 'buttons',
          text: `Hi ${first}! Your batchmates still don't have seats 👀 Only *${seatsLeft}* hall tickets left for AI60. 3 batchmates = gold ticket + priority Q&A.`,
          buttons: [{ id: 'invite', title: '👥 Invite my batch' }],
        },
      ]
    case 't24':
      return [
        {
          type: 'buttons',
          text: `⏰ *Tomorrow: AI60* · ${deps.workshopLabel}\n\n2-minute checklist so you build instead of signing up live:\n1. Free Gemini key: aistudio.google.com/apikey\n2. Hugging Face account: huggingface.co/join\n3. Laptop + Chrome`,
          buttons: [
            { id: 'ready', title: "✅ I'm ready" },
            { id: 'cant', title: "😕 Can't make it" },
          ],
        },
      ]
    case 't1':
      return [{ type: 'cta', text: '🚀 *AI60 starts in 1 hour!* Keep your Gemini key handy. Bring your batch.', label: 'Join the room', url: `${deps.siteUrl}/live` }]
    case 'post':
      return [
        {
          type: 'buttons',
          text: `🎉 You built an AI project today, ${first}!\n\nSend your live URL here to get it evaluated. Pass, and you get a certificate recruiters can verify.`,
          buttons: [{ id: 'submit', title: '📤 Submit project' }],
        },
      ]
  }
}
