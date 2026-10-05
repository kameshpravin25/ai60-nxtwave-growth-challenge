import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { useApp } from '../lib/state'
import { decodeCert, graderLabel, renderCertificate } from '../lib/certificate'
import { toBlob } from '../lib/ticket'

type Check = { state: 'checking' } | { state: 'done'; valid: boolean; demo: boolean } | { state: 'offline' }

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

export default function Verify({ token }: { token: string }) {
  const { openRegister } = useApp()
  const payload = decodeCert(token)
  const [check, setCheck] = useState<Check>({ state: 'checking' })
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/verify?t=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j: { valid: boolean; demoSignature: boolean }) => setCheck({ state: 'done', valid: j.valid, demo: j.demoSignature }))
      .catch(() => setCheck({ state: 'offline' }))
  }, [token])

  useEffect(() => {
    if (!payload) return
    let url: string | null = null
    renderCertificate(payload, token)
      .then(toBlob)
      .then((b) => setSrc((url = URL.createObjectURL(b))))
    return () => void (url && URL.revokeObjectURL(url))
  }, [token])

  const valid = check.state === 'done' && check.valid
  return (
    <div className="verify-page">
      <main className="wrap verify-main">
        <Link href="/" className="brand verify-brand">
          <span className="brand-mark" aria-hidden>
            <small>AI</small>60
          </span>
          <span className="brand-text">
            <b>Certificate verification</b>
            <span>AI60 · NxtWave</span>
          </span>
        </Link>

        {!payload ? (
          <div className="verify-banner bad">
            <b>✕ This link is not a valid AI60 certificate.</b>
          </div>
        ) : (
          <>
            <div className={`verify-banner ${check.state === 'checking' ? '' : valid ? 'good' : check.state === 'offline' ? 'warn' : 'bad'}`} role="status">
              {check.state === 'checking' && <b>Checking signature…</b>}
              {check.state === 'offline' && <b>! Signature could not be checked right now. Try again later.</b>}
              {check.state === 'done' &&
                (check.valid ? (
                  <b>
                    ✓ Verified. {payload.x ? 'This is a SAMPLE certificate from a demo run, not issued to a student.' : `${payload.n} built and shipped this project.`}
                  </b>
                ) : (
                  <b>✕ Signature does not match. This certificate was altered or not issued by AI60.</b>
                ))}
              {check.state === 'done' && check.demo && <small> Signed with the demo key (prototype deployment).</small>}
            </div>

            <div className="verify-grid">
              {src ? <img className="cert-img" src={src} alt={`Certificate ${payload.id}`} width={1600} height={1131} /> : <div className="cert-img ticket-skeleton" />}
              <dl className="verify-facts sheet">
                <div>
                  <dt>Student</dt>
                  <dd>
                    {payload.n}
                    <small>
                      {payload.c} · {payload.b}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Project</dt>
                  <dd>
                    {payload.p}
                    <small>
                      <a href={payload.u} target="_blank" rel="noreferrer">
                        {payload.u.replace(/^https?:\/\//, '')}
                      </a>
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>Score</dt>
                  <dd>
                    {payload.s}/100<small>Evaluated by {graderLabel(payload.g)}</small>
                  </dd>
                </div>
                <div>
                  <dt>Issued</dt>
                  <dd>
                    {dateFmt.format(payload.d)}
                    <small className="mono">ID {payload.id}</small>
                  </dd>
                </div>
                <div>
                  <dt>What it means</dt>
                  <dd className="small">The app was live when checked, the code calls an AI model, no secret keys were exposed, and it scored at least 60/100 on the AI60 rubric.</dd>
                </div>
              </dl>
            </div>
          </>
        )}

        <div className="verify-cta sheet">
          <div>
            <h2>Want one of these?</h2>
            <p>Free 60-minute live workshop for engineers from any branch. Build and deploy your first AI project.</p>
          </div>
          <button className="btn btn-lg" onClick={openRegister}>
            Get my hall ticket →
          </button>
        </div>
      </main>
    </div>
  )
}
