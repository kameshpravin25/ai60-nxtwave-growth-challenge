import { evaluate } from './_lib/evaluator.js'
import type { EvalInput } from '../src/lib/eval/rubric.js'

/**
 * POST /api/evaluate → newline-delimited JSON: one {type:"step"} line per pipeline step as it
 * finishes, then a final {type:"result"} line. Streaming lets the page show real progress.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

// Best-effort per-instance limiter: each evaluation can cost an LLM call.
const recent = new Map<string, number[]>()
function limited(ip: string): boolean {
  const now = Date.now()
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60_000)
  hits.push(now)
  recent.set(ip, hits)
  return hits.length > 8
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function POST(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return json({ error: 'Send JSON' }, 400)
  }

  const input: EvalInput = {
    url: text(body.url, 300),
    source: text(body.source, 300) || undefined,
    description: text(body.description, 700),
    name: text(body.name, 80),
    college: text(body.college, 80),
    branch: text(body.branch, 20),
    project: text(body.project, 60),
    code: text(body.code, 20),
    sample: body.sample === true,
  }
  try {
    const u = new URL(input.url)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error()
  } catch {
    return json({ error: 'Enter the full http(s) URL of your live app' }, 400)
  }
  if (input.description.length < 20) return json({ error: 'Describe your project in at least one sentence' }, 400)
  if (!input.name || !input.project) return json({ error: 'Name and project name are required' }, 400)

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local'
  if (limited(ip)) return json({ error: 'Too many evaluations from this network. Try again in 10 minutes.' }, 429)

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of evaluate(input)) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      } catch (e) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'error', message: e instanceof Error ? e.message : 'Evaluation failed' })}\n`))
      }
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } })
}
