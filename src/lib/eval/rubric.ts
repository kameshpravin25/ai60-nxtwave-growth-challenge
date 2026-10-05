/**
 * Shared by the browser and the serverless evaluator (api/_lib/evaluator.ts), so it must stay
 * dependency-free and must not touch import.meta.env.
 */

export type CriterionKey = 'works' | 'ai' | 'problem' | 'craft' | 'story'

export const CRITERIA: Array<{ key: CriterionKey; label: string; weight: number; desc: string }> = [
  { key: 'works', label: 'Works live', weight: 25, desc: 'The URL loads and the app is running.' },
  { key: 'ai', label: 'Meaningful AI use', weight: 25, desc: 'A model does real work, not decoration.' },
  { key: 'problem', label: 'Clear problem', weight: 20, desc: 'A specific problem for a specific user.' },
  { key: 'craft', label: 'Engineering judgement', weight: 20, desc: 'Prompt design, validation, errors handled, secrets kept out of code.' },
  { key: 'story', label: 'Explains it well', weight: 10, desc: 'The description reads like a good interview answer.' },
]

export const PASS_MARK = 60

export interface EvalInput {
  url: string
  source?: string
  description: string
  name: string
  college: string
  branch: string
  project: string
  code: string
  /** A demo run on someone else's public project: the certificate is marked SAMPLE. */
  sample?: boolean
}

export type Platform = 'huggingface' | 'hf-direct' | 'streamlit' | 'vercel' | 'netlify' | 'github-pages' | 'render' | 'replit' | 'other'

export interface Leak {
  kind: string
  file: string
  line: number
  preview: string
}

export interface CodeSignals {
  codeFile: string | null
  codeLines: number
  llm: string[]
  framework: string[]
  leaks: Leak[]
  usesEnvSecrets: boolean
  hasSystemPrompt: boolean
  hasErrorHandling: boolean
  hasStructuredOutput: boolean
  hasInputValidation: boolean
}

export interface Signals extends CodeSignals {
  reachable: boolean
  status: number | null
  latencyMs: number | null
  finalUrl: string | null
  title: string | null
  platform: Platform
  space: { id: string; sdk: string | null; stage: string | null; files: string[] } | null
  notes: string[]
}

export interface Grade {
  scores: Record<CriterionKey, number>
  strengths: string[]
  fixes: string[]
  summary: string
  interviewQuestion: string
  improvedBullet: string
}

export function weightedTotal(scores: Record<CriterionKey, number>): number {
  return Math.round(CRITERIA.reduce((sum, c) => sum + (Math.max(0, Math.min(5, scores[c.key])) / 5) * c.weight, 0))
}

export function detectPlatform(url: string): Platform {
  let host = ''
  let path = ''
  try {
    const u = new URL(url)
    host = u.hostname.toLowerCase()
    path = u.pathname
  } catch {
    return 'other'
  }
  if (host === 'huggingface.co' && path.startsWith('/spaces/')) return 'huggingface'
  if (host.endsWith('.hf.space')) return 'hf-direct'
  if (host.endsWith('.streamlit.app')) return 'streamlit'
  if (host.endsWith('.vercel.app')) return 'vercel'
  if (host.endsWith('.netlify.app')) return 'netlify'
  if (host.endsWith('.github.io')) return 'github-pages'
  if (host.endsWith('.onrender.com')) return 'render'
  if (host.endsWith('.replit.app') || host.endsWith('.repl.co')) return 'replit'
  return 'other'
}

/* ---------------- Static code analysis ---------------- */

const SECRETS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'Anthropic API key', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { kind: 'Google / Gemini API key', re: /AIza[0-9A-Za-z_-]{35}/ },
  { kind: 'OpenAI API key', re: /sk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{20,}/ },
  { kind: 'Hugging Face token', re: /hf_[A-Za-z0-9]{30,}/ },
  { kind: 'Groq API key', re: /gsk_[A-Za-z0-9]{20,}/ },
]

const LLM: Array<[string, RegExp]> = [
  ['Gemini API', /from google import genai|google\.genai|genai\.Client|google\.generativeai|GenerativeModel\(|@google\/genai/],
  ['OpenAI API', /from openai import|import openai|OpenAI\(|["']openai["']/],
  ['Claude API', /import anthropic|from anthropic import|Anthropic\(|@anthropic-ai\/sdk/],
  ['Groq', /from groq import|Groq\(/],
  ['Hugging Face Inference', /InferenceClient|huggingface_hub/],
  ['Transformers', /from transformers import|pipeline\(\s*["']/],
  ['LangChain', /langchain/],
  ['Ollama', /\bollama\b/],
]

const FRAMEWORKS: Array<[string, RegExp]> = [
  ['Gradio', /import gradio|gr\.Interface|gr\.Blocks|gr\.ChatInterface/],
  ['Streamlit', /import streamlit|\bst\.(title|write|text_input|chat_input|button)\b/],
  ['Flask', /from flask import/],
  ['FastAPI', /from fastapi import/],
  ['React', /from ["']react["']/],
]

export function redact(secret: string): string {
  return `${secret.slice(0, 6)}…${secret.slice(-2)}`
}

export function analyzeCode(files: Array<{ name: string; text: string }>): CodeSignals {
  const all = files.map((f) => f.text).join('\n')
  const main = files.find((f) => /\.(py|js|ts|tsx|jsx)$/.test(f.name)) ?? null
  const leaks: Leak[] = []
  for (const f of files) {
    f.text.split('\n').forEach((line, i) => {
      for (const s of SECRETS) {
        const m = line.match(s.re)
        if (m) {
          leaks.push({ kind: s.kind, file: f.name, line: i + 1, preview: redact(m[0]) })
          break
        }
      }
    })
  }
  return {
    codeFile: main?.name ?? null,
    codeLines: main ? main.text.split('\n').length : 0,
    llm: LLM.filter(([, re]) => re.test(all)).map(([n]) => n),
    framework: FRAMEWORKS.filter(([, re]) => re.test(all)).map(([n]) => n),
    leaks,
    usesEnvSecrets: /os\.environ|os\.getenv|process\.env|st\.secrets|userdata\.get/.test(all),
    hasSystemPrompt: /system_instruction|system_prompt|\bSYSTEM\s*=|["']role["']\s*:\s*["']system["']|role:\s*["']system["']|\bsystem\s*:\s*[`"']/.test(all),
    hasErrorHandling: /\btry\s*:|\bexcept\b|\bcatch\s*\(/.test(all),
    hasStructuredOutput: /response_schema|response_mime_type|json\.loads|JSON\.parse|BaseModel|output_config|json_schema/.test(all),
    hasInputValidation: /if not [\w.]+(\.strip\(\))?\s*:|is None|\.strip\(\)|len\([^)]+\)\s*[<>]/.test(all),
  }
}

export const NO_CODE: CodeSignals = {
  codeFile: null,
  codeLines: 0,
  llm: [],
  framework: [],
  leaks: [],
  usesEnvSecrets: false,
  hasSystemPrompt: false,
  hasErrorHandling: false,
  hasStructuredOutput: false,
  hasInputValidation: false,
}

/* ---------------- Deterministic parts of the grade ---------------- */

/** "Works live" is measured, never judged: an LLM can't be talked into it. */
export function worksScore(s: Signals): number {
  if (s.space?.stage) {
    const stage = s.space.stage.toUpperCase()
    if (stage === 'RUNNING') return 5
    if (stage === 'SLEEPING' || stage === 'PAUSED') return 4
    if (stage.includes('BUILD') || stage === 'APP_STARTING') return 2
    if (stage.includes('ERROR')) return 0
  }
  if (!s.reachable || !s.status || s.status >= 400) return 0
  let score = 4
  if ((s.latencyMs ?? 0) > 6000) score -= 1
  if (!s.title) score -= 1
  return Math.max(0, score)
}

export function stackLine(s: Signals): string {
  const host =
    s.platform === 'huggingface' || s.platform === 'hf-direct'
      ? 'Hugging Face Spaces'
      : s.platform === 'other'
        ? null
        : { streamlit: 'Streamlit Cloud', vercel: 'Vercel', netlify: 'Netlify', 'github-pages': 'GitHub Pages', render: 'Render', replit: 'Replit' }[s.platform]
  return [...s.llm, ...s.framework, host].filter(Boolean).join(', ')
}

/* ---------------- Heuristic grader (used when no AI grader is configured) ---------------- */

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean)

export function heuristicGrade(s: Signals, input: EvalInput): Grade {
  const desc = input.description.trim()
  const w = words(desc).length
  const hasCode = Boolean(s.codeFile)

  const ai = hasCode ? (s.llm.length ? 3 + (s.hasSystemPrompt ? 1 : 0) + (s.hasStructuredOutput ? 1 : 0) : 1) : /\b(ai|llm|gemini|gpt|claude|model|prompt)\b/i.test(desc) ? 2 : 0

  let problem = 0
  if (w >= 12) problem += 2
  if (/\b(for|helps?|students?|engineers?|users?|technicians?|recruiters?|farmers?|teachers?)\b/i.test(desc)) problem += 1
  if (/\b(upload|paste|returns?|scores?|extracts?|generates?|explains?|summari[sz]es?|answers?|estimates?|detects?)\b/i.test(desc)) problem += 1
  if (!/^(my|test|demo|untitled|app)\b/i.test(input.project.trim()) && input.project.trim().length > 2) problem += 1

  const craft = s.leaks.length
    ? 0
    : hasCode
      ? [s.hasSystemPrompt, s.hasErrorHandling, s.usesEnvSecrets, s.hasStructuredOutput, s.hasInputValidation].filter(Boolean).length
      : 1

  let story = w >= 20 && w <= 140 ? 2 : w >= 10 ? 1 : 0
  if (/\b(because|so that|i learned|the hard part|instead of|trade-?off|i chose|decided)\b/i.test(desc)) story += 2
  if (/\d/.test(desc)) story += 1

  const scores = { works: worksScore(s), ai: Math.min(5, ai), problem: Math.min(5, problem), craft: Math.min(5, craft), story: Math.min(5, story) }

  const strengths: string[] = []
  if (scores.works >= 4) strengths.push(s.space?.stage ? `Space is ${s.space.stage.toLowerCase()}. Anyone can open it.` : `Live and responding${s.latencyMs ? ` in ${s.latencyMs} ms` : ''}.`)
  if (s.llm.length) strengths.push(`Uses the ${s.llm.join(' + ')} for the core feature.`)
  if (s.hasSystemPrompt) strengths.push('A system prompt sets the model’s role and rules.')
  if (s.usesEnvSecrets && !s.leaks.length) strengths.push('API key kept in a secret, not in the code.')

  const fixes: string[] = []
  if (s.leaks.length) fixes.push(`Your ${s.leaks[0].kind} is visible in ${s.leaks[0].file} (line ${s.leaks[0].line}). Rotate it now and move it to a Space Secret.`)
  if (scores.works < 4) fixes.push(s.space?.stage ? `Space status is ${s.space.stage}. Open the Logs tab and fix the build or runtime error.` : 'The URL did not load cleanly. Check it opens in an incognito window.')
  if (s.space?.stage === 'SLEEPING') fixes.push('Your Space is sleeping. Open it before an interview so it loads instantly.')
  if (hasCode && !s.hasErrorHandling) fixes.push('Wrap the API call in try/except so users see a friendly error instead of a crash.')
  if (hasCode && !s.hasSystemPrompt) fixes.push('Add a system prompt that sets the role and the exact output format.')
  if (!hasCode) fixes.push('Add a source link (Space files or GitHub) so the evaluator can review your code.')
  if (problem < 4) fixes.push('Say who it helps and what it returns, e.g. "helps final-years check resume fit and rewrites 3 bullets".')
  if (story < 3) fixes.push('Add one judgement call to your description: what was hard, and what you decided.')

  const stack = stackLine(s) || 'an LLM API'
  const where = (s.finalUrl ?? input.url).replace(/^https?:\/\//, '').replace(/\/$/, '')

  return {
    scores,
    strengths: strengths.slice(0, 3),
    fixes: fixes.slice(0, 3),
    summary:
      weightedTotal(scores) >= PASS_MARK
        ? `${input.project} is live and does real AI work. Fix the points below to make it interview-ready.`
        : `${input.project} isn't certifiable yet. The fixes below are what's missing.`,
    interviewQuestion: !s.hasStructuredOutput
      ? 'How would you make the model’s output reliable enough to show in a UI every time?'
      : s.leaks.length
        ? 'How do you handle secrets like API keys in a deployed app?'
        : 'What would break first if 1,000 students used your app at the same time?',
    improvedBullet: `Built and deployed ${input.project}, ${describeForBullet(desc)} (${stack}); live at ${where}.`,
  }
}

/** Turns a student's first sentence into a resume-bullet clause, whatever grammar it started with. */
export function describeForBullet(desc: string): string {
  let clause = desc.split(/[.!?\n]/)[0].replace(/^(it|this|my app|this app|i built|i made)\s+/i, '').trim()
  const w = clause.split(/\s+/)
  if (w.length > 18) clause = w.slice(0, 18).join(' ').replace(/[,;:]$/, '')
  if (!clause) return 'an AI app that solves a real problem'
  const lower = clause.charAt(0).toLowerCase() + clause.slice(1)
  if (/^(an?|the)\s/i.test(clause)) return lower
  if (/^(upload|paste|enter|type|describe|give|ask|drop|snap|take|add|pick|choose|select|record|speak|send)\b/i.test(clause)) return `an AI app that lets users ${lower}`
  return `an AI app that ${lower}`
}

/** Certificate decision. Deterministic gates first; the score only decides among working projects. */
export function decide(s: Signals, total: number): { pass: boolean; reasons: string[] } {
  const reasons: string[] = []
  if (worksScore(s) < 3) reasons.push('The app is not live or not running.')
  if (s.leaks.length) reasons.push('A secret key is exposed in the code. Rotate it and resubmit.')
  if (s.codeFile && !s.llm.length) reasons.push('No AI model call was found in the code.')
  if (total < PASS_MARK) reasons.push(`Score ${total} is below the pass mark of ${PASS_MARK}.`)
  return { pass: reasons.length === 0, reasons }
}
