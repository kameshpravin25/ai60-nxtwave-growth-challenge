import { useEffect, useState, type FormEvent } from 'react'
import type { EvalEvent, StepId, StepStatus } from '../../api/_lib/evaluator'
import { useApp } from '../lib/state'
import { Link } from '../lib/router'
import { BRANCHES } from '../data/branches'
import { CRITERIA, PASS_MARK } from '../lib/eval/rubric'
import { decodeCert, graderLabel, linkedinAddUrl, renderCertificate, verifyUrl, type CertPayload } from '../lib/certificate'
import { toBlob } from '../lib/ticket'
import { copyText, downloadBlob } from '../lib/share'
import { transport } from '../lib/live/transport'
import { useIdentity } from '../lib/live/useRoom'
import type { Branch } from '../types'

type Result = Extract<EvalEvent, { type: 'result' }>
type StepState = { id: StepId | 'dup'; label: string; status: StepStatus | 'idle'; detail: string }

const STEPS: Array<{ id: StepId | 'dup'; label: string }> = [
  { id: 'dup', label: 'Duplicate check' },
  { id: 'live', label: 'Is it live?' },
  { id: 'read', label: 'Reading the project' },
  { id: 'security', label: 'Security scan' },
  { id: 'grade', label: 'Grading against the rubric' },
  { id: 'decide', label: 'Decision' },
]

const SAMPLE = {
  url: 'https://huggingface.co/spaces/Roboflow/Gemini',
  source: '',
  project: 'Gemini Playground (sample)',
  description: 'A public Gemini playground: upload an image or ask a question and the model answers. Used here only to demo the evaluator on a real, running Space.',
}

const HISTORY_KEY = 'ai60_evals'
const norm = (u: string) => u.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '')

interface HistoryItem {
  url: string
  code: string
  total: number
  pass: boolean
  token: string | null
  at: number
}

function history(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryItem[]
  } catch {
    return []
  }
}

const ICON: Record<StepState['status'], string> = { idle: '·', running: '', done: '✓', warn: '!', fail: '✕', skip: '–' }

function Pipeline({ steps }: { steps: StepState[] }) {
  return (
    <ol className="pipeline" aria-live="polite">
      {steps.map((s) => (
        <li key={s.id} className={`pl-${s.status}`}>
          <span className="pl-icon" aria-hidden>
            {s.status === 'running' ? <span className="spinner" /> : ICON[s.status]}
          </span>
          <div>
            <b>{s.label}</b>
            {s.detail && <p>{s.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

function Certificate({ token, held }: { token: string; held: boolean }) {
  const payload = decodeCert(token) as CertPayload
  const [src, setSrc] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    let url: string | null = null
    renderCertificate(payload, token)
      .then(toBlob)
      .then((b) => setSrc((url = URL.createObjectURL(b))))
    return () => void (url && URL.revokeObjectURL(url))
  }, [token])

  if (held) {
    return (
      <div className="cert-held">
        <b>Certificate held for review.</b> This URL was already submitted with another hall ticket. A mentor will check it and release the certificate.
      </div>
    )
  }
  return (
    <div className="cert-wrap">
      {src ? <img className="cert-img" src={src} alt={`Certificate for ${payload.p}`} width={1600} height={1131} /> : <div className="cert-img ticket-skeleton" />}
      <div className="row-btns">
        <button
          className="btn"
          onClick={async () => {
            const blob = await toBlob(await renderCertificate(payload, token))
            downloadBlob(blob, `AI60-certificate-${payload.id}.png`)
          }}
        >
          Download certificate
        </button>
        <a className="btn btn-ghost" href={linkedinAddUrl(payload, token)} target="_blank" rel="noreferrer">
          Add to LinkedIn profile
        </a>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            setCopied(await copyText(verifyUrl(token)))
            window.setTimeout(() => setCopied(false), 1500)
          }}
        >
          {copied ? 'Copied ✓' : 'Copy verify link'}
        </button>
        <Link className="btn btn-ghost" href={`/verify/${token}`}>
          Open verify page
        </Link>
      </div>
    </div>
  )
}

export default function Submit() {
  const { me, myName } = useApp()
  const [identity] = useIdentity()
  const branch: Branch = me?.branch ?? 'CSE'
  const params = new URLSearchParams(window.location.search)
  const [f, setF] = useState({
    url: params.get('url') ?? '',
    source: '',
    project: BRANCHES.find((b) => b.branch === branch)?.project ?? '',
    description: '',
    name: myName ?? me?.name ?? '',
    college: me?.college ?? '',
    branch: branch as string,
  })
  const [sample, setSample] = useState(false)
  const [steps, setSteps] = useState<StepState[] | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const set = (k: keyof typeof f, v: string) => {
    setSample(false)
    setF((prev) => ({ ...prev, [k]: v }))
  }

  const update = (id: StepState['id'], status: StepState['status'], detail: string) =>
    setSteps((prev) => prev?.map((s) => (s.id === id ? { ...s, status, detail } : s)) ?? prev)

  const run = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setResult(null)
    const code = identity?.who ?? me?.code ?? 'GUEST'
    setSteps(STEPS.map((s) => ({ ...s, status: 'idle', detail: '' })))
    setBusy(true)

    // 0. Duplicate check: the same project URL under a different hall ticket gets held for review.
    const url = norm(f.url)
    const seenLocally = history().find((h) => norm(h.url) === url && h.code !== code)
    const seenInRoom = transport.events().find((ev) => ev.kind === 'ship' && norm(ev.url) === url && ev.who !== code)
    const dup = !sample && Boolean(seenLocally || seenInRoom)
    setDuplicate(dup)
    update('dup', dup ? 'warn' : 'done', dup ? `Already submitted with ${seenLocally?.code ?? seenInRoom?.who}. Flagged for manual review.` : 'Not submitted by anyone else')

    try {
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...f, code, sample }),
      })
      if (!res.ok || !res.body) {
        const detail = await res.json().catch(() => ({ error: `Evaluator unavailable (${res.status})` }))
        throw new Error(detail.error ?? 'Evaluation failed')
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim()
          buffer = buffer.slice(nl + 1)
          if (!line) continue
          const ev = JSON.parse(line) as EvalEvent | { type: 'error'; message: string }
          if (ev.type === 'step') update(ev.id, ev.status, ev.detail)
          else if (ev.type === 'error') throw new Error(ev.message)
          else {
            setResult(ev)
            try {
              localStorage.setItem(HISTORY_KEY, JSON.stringify([...history(), { url: f.url, code, total: ev.total, pass: ev.pass, token: ev.certificate, at: Date.now() }].slice(-30)))
            } catch {
              /* ignore */
            }
            // Tell the live room: milestone done, project on the shipped wall with its score.
            if (identity && !sample) {
              await transport.post(identity.who, { kind: 'check', milestone: 'submit' })
              await transport.post(identity.who, { kind: 'ship', url: f.url, project: f.project, name: identity.name, college: identity.college, score: ev.total })
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evaluation failed')
      setSteps((prev) => prev?.map((s) => (s.status === 'running' || s.status === 'idle' ? { ...s, status: 'skip' } : s)) ?? prev)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="submit-page">
      <header className="db-top">
        <div className="wrap db-top-inner">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden>
              <small>AI</small>60
            </span>
            <span className="brand-text">
              <b>Project evaluator</b>
              <span>Automated review + certificate</span>
            </span>
          </Link>
          <div className="db-top-meta">
            <Link href="/live" className="linkish">
              Workshop room
            </Link>
            <Link href="/host" className="linkish">
              Host console
            </Link>
          </div>
        </div>
      </header>

      <main className="wrap submit-main">
        <div className="submit-intro">
          <span className="mono small-label">Step 5 · Package it</span>
          <h1>
            Ship it. Get it <span className="hl">evaluated.</span> Get the certificate.
          </h1>
          <p className="lede">
            The certificate isn't for attending. It's for a project that's live, uses AI for real and keeps its keys secret. The checks below run automatically in about
            10 seconds.
          </p>
          <ul className="rubric-list">
            {CRITERIA.map((c) => (
              <li key={c.key}>
                <b>{c.label}</b> <span className="mono">{c.weight}%</span>
                <small>{c.desc}</small>
              </li>
            ))}
            <li className="rubric-pass">
              Pass mark <b className="mono">{PASS_MARK}/100</b>, live app, no exposed secrets
            </li>
          </ul>
        </div>

        <div className="submit-grid">
          <form className="sheet submit-form" onSubmit={run}>
            <div className="submit-form-head">
              <h2>Submit your project</h2>
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  setF((prev) => ({ ...prev, ...SAMPLE, name: prev.name || 'Sample Student', college: prev.college || 'Demo College' }))
                  setSample(true)
                }}
              >
                Try a sample project
              </button>
            </div>
            {sample && <p className="sample-note">Sample run on a public Space. The certificate is signed and marked SAMPLE.</p>}
            <label className="field">
              <span>Live app URL</span>
              <input value={f.url} onChange={(e) => set('url', e.target.value)} placeholder="https://huggingface.co/spaces/you/resumeradar" required />
            </label>
            <label className="field">
              <span>Source code link (optional if it's a Space)</span>
              <input value={f.source} onChange={(e) => set('source', e.target.value)} placeholder="https://github.com/you/resumeradar" />
            </label>
            <label className="field">
              <span>Project name</span>
              <input value={f.project} onChange={(e) => set('project', e.target.value)} required maxLength={60} />
            </label>
            <label className="field">
              <span>Describe it like you would in an interview</span>
              <textarea
                value={f.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
                maxLength={700}
                required
                placeholder="Who it helps, what it does, and one decision you made. e.g. It reads a job description and a resume and scores the fit. The hard part was clean JSON, so I added a schema."
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Name on certificate</span>
                <input value={f.name} onChange={(e) => set('name', e.target.value)} required maxLength={80} />
              </label>
              <label className="field">
                <span>College</span>
                <input value={f.college} onChange={(e) => set('college', e.target.value)} required maxLength={80} />
              </label>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-lg btn-block" disabled={busy}>
              {busy ? 'Evaluating…' : 'Evaluate my project →'}
            </button>
          </form>

          <div className="submit-side">
            {steps ? <Pipeline steps={steps} /> : <div className="sheet pipeline-empty">The pipeline appears here: liveness, source code, secret scan, AI grading, decision.</div>}
          </div>
        </div>

        {result && (
          <section className="result sheet" aria-label="Evaluation result">
            <div className="result-head">
              <div className={`score-dial ${result.pass ? 'pass' : 'fail'}`}>
                <b>{result.total}</b>
                <span>/100</span>
              </div>
              <div>
                <span className={`status ${result.pass ? 's-good' : 's-warn'}`}>{result.pass ? '✓ Passed' : '✕ Not yet'}</span>
                <h2>{result.grade.summary}</h2>
                <p className="db-muted">
                  Graded by {graderLabel(result.grader)}
                  {result.graderNote ? `. ${result.graderNote}` : ''}
                </p>
                {!result.pass && (
                  <ul className="reasons">
                    {result.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="result-grid">
              <div>
                <h3>Rubric</h3>
                <ul className="crit-list">
                  {CRITERIA.map((c) => (
                    <li key={c.key}>
                      <span>
                        {c.label} <small className="mono">{c.weight}%</small>
                      </span>
                      <span className="crit-dots" aria-label={`${result.grade.scores[c.key]} out of 5`}>
                        {[0, 1, 2, 3, 4].map((i) => (
                          <i key={i} className={i < result.grade.scores[c.key] ? 'on' : ''} />
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
                {result.grade.strengths.length > 0 && (
                  <>
                    <h3>What's good</h3>
                    <ul className="good-list">
                      {result.grade.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
              <div>
                <h3>Fix next</h3>
                <ol className="fix-list">
                  {result.grade.fixes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <h3>Practise this interview question</h3>
                <p className="interview-q">“{result.grade.interviewQuestion}”</p>
                <h3>Your resume line</h3>
                <p className="resume-line">• {result.grade.improvedBullet}</p>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={async () => {
                    setCopied(await copyText(result.grade.improvedBullet))
                    window.setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied ? 'Copied ✓' : 'Copy resume line'}
                </button>
              </div>
            </div>

            {result.certificate && <Certificate token={result.certificate} held={duplicate} />}
            {result.demoSignature && result.certificate && <p className="db-muted small">Signed with the demo key. Set CERT_SECRET in production.</p>}
          </section>
        )}
      </main>
    </div>
  )
}
