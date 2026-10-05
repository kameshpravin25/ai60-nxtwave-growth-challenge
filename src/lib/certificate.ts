import QRCode from 'qrcode'
import { C, DISPLAY, HAND, MONO, SANS, drawStamp, ensureFonts, fitFont, label, securityPattern, signature, spacing } from './ticket'

export interface CertPayload {
  v: 1
  id: string
  n: string
  c: string
  b: string
  p: string
  u: string
  s: number
  g: string
  k: string
  d: number
  x?: 1
}

export const CERT_W = 1600
export const CERT_H = 1131

/** Reads the (unverified) payload out of a certificate token. The server checks the signature. */
export function decodeCert(token: string): CertPayload | null {
  try {
    const body = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      [...atob(body.padEnd(Math.ceil(body.length / 4) * 4, '='))].map((ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    )
    return JSON.parse(json) as CertPayload
  } catch {
    return null
  }
}

export const verifyUrl = (token: string) => `${window.location.origin}/verify/${token}`

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })

export const graderLabel = (g: string) => (g === 'rubric' ? 'AI60 rubric evaluator' : `Claude (${g})`)

export async function renderCertificate(p: CertPayload, token: string): Promise<HTMLCanvasElement> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = CERT_W
  canvas.height = CERT_H
  const ctx = canvas.getContext('2d')!
  const cx = CERT_W / 2

  ctx.fillStyle = C.paper
  ctx.fillRect(0, 0, CERT_W, CERT_H)
  securityPattern(ctx, CERT_W, CERT_H)

  ctx.strokeStyle = C.blue
  ctx.lineWidth = 8
  ctx.strokeRect(32, 32, CERT_W - 64, CERT_H - 64)
  ctx.lineWidth = 2
  ctx.strokeRect(50, 50, CERT_W - 100, CERT_H - 100)
  ctx.strokeStyle = C.gold
  ctx.lineWidth = 1.5
  ctx.strokeRect(62, 62, CERT_W - 124, CERT_H - 124)

  // Logo + id
  ctx.lineWidth = 6
  ctx.strokeStyle = C.blue
  ctx.beginPath()
  ctx.roundRect(110, 100, 112, 112, 16)
  ctx.stroke()
  ctx.fillStyle = C.blue
  ctx.textAlign = 'center'
  ctx.font = `700 20px ${MONO}`
  ctx.fillText('AI', 166, 136)
  ctx.font = `800 56px ${DISPLAY}`
  ctx.fillText('60', 166, 192)
  ctx.textAlign = 'right'
  label(ctx, 'Certificate ID', CERT_W - 110, 128)
  ctx.font = `700 30px ${MONO}`
  ctx.fillStyle = C.ink
  ctx.fillText(p.id, CERT_W - 110, 168)

  // Title
  ctx.textAlign = 'center'
  ctx.fillStyle = C.ink2
  ctx.font = `400 22px ${MONO}`
  spacing(ctx, 6)
  ctx.fillText('NXTWAVE · AI60 · EXPERIMENT NO. 1', cx, 150)
  spacing(ctx, -1)
  ctx.fillStyle = C.ink
  ctx.font = `800 84px ${DISPLAY}`
  ctx.fillText('CERTIFICATE OF SHIPPING', cx, 250)
  spacing(ctx, 0)
  ctx.fillStyle = C.blue
  ctx.font = `600 30px ${SANS}`
  ctx.fillText('Build Your First AI Project in 60 Minutes', cx, 300)

  ctx.fillStyle = C.ink2
  ctx.font = `500 28px ${SANS}`
  ctx.fillText('This certifies that', cx, 382)
  ctx.fillStyle = C.ink
  fitFont(ctx, p.n, 1100, (s) => `800 ${s}px ${DISPLAY}`, 80, 40)
  ctx.fillText(p.n, cx, 470)
  ctx.fillStyle = C.ink2
  ctx.font = `500 28px ${SANS}`
  ctx.fillText(`${p.c} · ${p.b === 'OTHER' ? 'Engineering' : p.b}`, cx, 520)
  ctx.fillText('built, deployed and passed evaluation for', cx, 580)
  ctx.fillStyle = C.blue
  fitFont(ctx, p.p, 1000, (s) => `800 ${s}px ${DISPLAY}`, 72, 36)
  ctx.fillText(p.p, cx, 664)
  ctx.fillStyle = C.ink2
  const link = p.u.replace(/^https?:\/\//, '')
  fitFont(ctx, link, 1100, (s) => `400 ${s}px ${MONO}`, 24, 14)
  ctx.fillText(link, cx, 708)

  // Result line, lab-record style
  ctx.font = `700 34px ${HAND}`
  ctx.fillStyle = C.red
  ctx.fillText(`Result: live URL verified · ${p.s}/100`, cx, 782)

  // Footer: date, QR, signature, stamp
  ctx.textAlign = 'left'
  label(ctx, 'Issued', 140, 880)
  ctx.font = `600 28px ${SANS}`
  ctx.fillStyle = C.ink
  ctx.fillText(dateFmt.format(p.d), 140, 918)
  label(ctx, 'Evaluated by', 140, 970)
  ctx.font = `600 24px ${SANS}`
  ctx.fillText(graderLabel(p.g), 140, 1004)

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, verifyUrl(token), { margin: 1, width: 190, errorCorrectionLevel: 'L', color: { dark: C.ink, light: '#FFFFFF' } })
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(cx - 99, 846, 198, 198)
  ctx.drawImage(qr, cx - 95, 850, 190, 190)
  ctx.textAlign = 'center'
  label(ctx, 'Scan to verify', cx, 1070)

  ctx.textAlign = 'left'
  signature(ctx, 1010, 944)
  ctx.fillStyle = C.ink
  ctx.fillRect(1006, 958, 250, 2)
  label(ctx, 'Controller of Builds', 1006, 990)

  if (p.x) {
    ctx.save()
    ctx.translate(cx, CERT_H / 2)
    ctx.rotate(-0.32)
    ctx.textAlign = 'center'
    ctx.font = `800 220px ${DISPLAY}`
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(217, 58, 43, 0.3)'
    spacing(ctx, 14)
    ctx.strokeText('SAMPLE', 0, 70)
    ctx.restore()
  }

  drawStamp(ctx, 1380, 930, 104, new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(p.d).toUpperCase(), 'VERIFIED')
  return canvas
}

/** LinkedIn's "Add licence or certification" deep link, pre-filled. */
export function linkedinAddUrl(p: CertPayload, token: string): string {
  const d = new Date(p.d)
  const params = new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: `AI60: ${p.p} (Build Your First AI Project in 60 Minutes)`,
    organizationName: 'NxtWave',
    issueYear: String(d.getFullYear()),
    issueMonth: String(d.getMonth() + 1),
    certUrl: verifyUrl(token),
    certId: p.id,
  })
  return `https://www.linkedin.com/profile/add?${params}`
}
