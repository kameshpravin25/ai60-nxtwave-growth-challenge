import QRCode from 'qrcode'
import { initials } from './rand'
import { formatDay, formatTime } from './time'

export type TicketTier = 'standard' | 'pack' | 'batch' | 'topper'

export interface TicketData {
  name: string
  college: string
  branch: string
  gradYear: number | string
  seat: number | null
  code: string
  workshopAt: number
  link: string
  tier: TicketTier
  refCount: number
  specimen?: boolean
  stamp?: boolean
}

export const TICKET_W = 1080
export const TICKET_H = 1350
/** Where the stamp sits, as fractions of the ticket, so the page can overlay an animated stamp. */
export const STAMP_POS = { x: 900 / TICKET_W, y: 1168 / TICKET_H, r: 112 / TICKET_W }

export const C = {
  paper: '#FBF8F0',
  goldPaper: '#FBF2D9',
  ink: '#16181D',
  ink2: '#5A5F6B',
  faint: 'rgba(31, 63, 209, 0.055)',
  blue: '#1F3FD1',
  red: '#D93A2B',
  gold: '#A87908',
}

export const DISPLAY = '"Bricolage Grotesque", "Arial Black", sans-serif'
export const SANS = '"Instrument Sans", Arial, sans-serif'
export const MONO = '"JetBrains Mono", Consolas, monospace'
export const HAND = 'Kalam, "Comic Sans MS", cursive'

let fontsReady: Promise<unknown> | null = null
export function ensureFonts() {
  fontsReady ??= Promise.all(
    [
      `800 92px ${DISPLAY}`,
      `600 48px ${DISPLAY}`,
      `500 24px ${SANS}`,
      `600 30px ${SANS}`,
      `700 30px ${SANS}`,
      `400 20px ${MONO}`,
      `700 44px ${MONO}`,
      `400 30px ${HAND}`,
      `700 110px ${HAND}`,
    ].map((f) => document.fonts.load(f)),
  ).catch(() => undefined)
  return fontsReady
}

export type Ctx = CanvasRenderingContext2D

export function spacing(ctx: Ctx, px: number) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${px}px`
}

export function fitFont(ctx: Ctx, text: string, maxW: number, font: (s: number) => string, size: number, min: number) {
  let s = size
  ctx.font = font(s)
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2
    ctx.font = font(s)
  }
  return s
}

export function label(ctx: Ctx, text: string, x: number, y: number, color = C.ink2) {
  ctx.font = `400 19px ${MONO}`
  ctx.fillStyle = color
  spacing(ctx, 2.5)
  ctx.fillText(text.toUpperCase(), x, y)
  spacing(ctx, 0)
}

export function securityPattern(ctx: Ctx, w = TICKET_W, h = TICKET_H) {
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-0.33)
  ctx.font = `800 30px ${DISPLAY}`
  ctx.fillStyle = C.faint
  const row = 'AI60 · BUILD · SHIP · '.repeat(8)
  const reach = Math.max(w, h)
  for (let y = -reach; y < reach; y += 54) ctx.fillText(row, -reach - 100 + ((y / 54) % 2) * 60, y)
  ctx.restore()
}

export function drawStamp(ctx: Ctx, cx: number, cy: number, r: number, dateText: string, word = 'ALLOTTED') {
  const size = Math.ceil(r * 2 + 40)
  const off = document.createElement('canvas')
  off.width = off.height = size
  const s = off.getContext('2d')!
  const m = size / 2
  s.translate(m, m)
  s.rotate(-0.24)
  s.strokeStyle = s.fillStyle = C.red

  s.lineWidth = 7
  s.beginPath()
  s.arc(0, 0, r, 0, Math.PI * 2)
  s.stroke()
  s.lineWidth = 2.5
  s.beginPath()
  s.arc(0, 0, r - 15, 0, Math.PI * 2)
  s.stroke()

  // Text around the ring
  const ring = '★ AI60 HALL TICKET ★ VERIFIED SEAT '
  s.font = `700 17px ${MONO}`
  const step = (Math.PI * 2) / ring.length
  for (let i = 0; i < ring.length; i++) {
    s.save()
    s.rotate(i * step)
    s.translate(0, -(r - 31))
    s.textAlign = 'center'
    s.fillText(ring[i], 0, 6)
    s.restore()
  }

  // Centre band
  s.fillRect(-r + 18, -30, (r - 18) * 2, 4)
  s.fillRect(-r + 18, 30, (r - 18) * 2, 4)
  s.textAlign = 'center'
  s.font = `800 44px ${DISPLAY}`
  s.fillText(word, 0, 16)
  s.font = `700 15px ${MONO}`
  s.fillText(dateText, 0, 56)

  // Ink wear: knock out specks so it reads as a rubber stamp, not a vector.
  s.setTransform(1, 0, 0, 1, 0, 0)
  s.globalCompositeOperation = 'destination-out'
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 260; i++) {
    s.globalAlpha = 0.25 + rand() * 0.6
    s.beginPath()
    s.arc(rand() * size, rand() * size, 0.6 + rand() * 2.2, 0, Math.PI * 2)
    s.fill()
  }

  ctx.save()
  ctx.globalAlpha = 0.88
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(off, cx - m, cy - m)
  ctx.restore()
}

export function signature(ctx: Ctx, x: number, y: number) {
  ctx.save()
  ctx.strokeStyle = C.blue
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.bezierCurveTo(x + 20, y - 46, x + 40, y + 6, x + 56, y - 24)
  ctx.bezierCurveTo(x + 70, y - 50, x + 78, y + 10, x + 98, y - 14)
  ctx.bezierCurveTo(x + 116, y - 36, x + 124, y - 2, x + 150, y - 10)
  ctx.bezierCurveTo(x + 170, y - 16, x + 186, y - 22, x + 210, y - 30)
  ctx.stroke()
  ctx.restore()
}

export async function renderTicket(d: TicketData): Promise<HTMLCanvasElement> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = TICKET_W
  canvas.height = TICKET_H
  const ctx = canvas.getContext('2d')!
  const gold = d.tier === 'batch' || d.tier === 'topper'
  const frame = gold ? C.gold : C.blue

  ctx.fillStyle = gold ? C.goldPaper : C.paper
  ctx.fillRect(0, 0, TICKET_W, TICKET_H)
  securityPattern(ctx)

  // Double frame
  ctx.strokeStyle = frame
  ctx.lineWidth = 6
  ctx.strokeRect(28, 28, TICKET_W - 56, TICKET_H - 56)
  ctx.lineWidth = 1.5
  ctx.strokeRect(42, 42, TICKET_W - 84, TICKET_H - 84)

  // Header: logo
  ctx.lineWidth = 6
  ctx.strokeStyle = frame
  ctx.beginPath()
  ctx.roundRect(80, 82, 128, 128, 18)
  ctx.stroke()
  ctx.fillStyle = frame
  ctx.textAlign = 'center'
  ctx.font = `700 22px ${MONO}`
  ctx.fillText('AI', 144, 122)
  ctx.font = `800 64px ${DISPLAY}`
  ctx.fillText('60', 144, 184)
  ctx.fillStyle = C.red
  ctx.beginPath()
  ctx.arc(196, 96, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.textAlign = 'left'

  label(ctx, 'NxtWave · Free live workshop', 240, 108)
  ctx.fillStyle = C.ink
  ctx.font = `800 90px ${DISPLAY}`
  spacing(ctx, -1)
  ctx.fillText('HALL TICKET', 236, 192)
  spacing(ctx, 0)
  ctx.fillStyle = frame
  ctx.font = `600 29px ${SANS}`
  ctx.fillText('Build Your First AI Project in 60 Minutes', 240, 238)

  // Tier ribbon
  if (gold) {
    ctx.save()
    ctx.translate(TICKET_W - 118, 118)
    ctx.rotate(Math.PI / 4)
    ctx.fillStyle = C.gold
    ctx.fillRect(-190, -26, 380, 52)
    ctx.fillStyle = '#FFF8E6'
    ctx.textAlign = 'center'
    ctx.font = `700 22px ${MONO}`
    spacing(ctx, 3)
    ctx.fillText(d.tier === 'topper' ? '★ TOPPER ★' : '★ BATCH ★', 0, 8)
    ctx.restore()
  }

  // Divider
  ctx.fillStyle = C.ink
  ctx.fillRect(80, 282, TICKET_W - 160, 3)
  ctx.fillRect(80, 290, TICKET_W - 160, 1)

  // Fields
  const name = d.name.toUpperCase()
  label(ctx, "Candidate's name (in block letters)", 80, 346)
  fitFont(ctx, name, 600, (s) => `600 ${s}px ${DISPLAY}`, 50, 28)
  ctx.fillStyle = C.ink
  ctx.fillText(name, 80, 402)

  label(ctx, 'College', 80, 462)
  fitFont(ctx, d.college, 600, (s) => `600 ${s}px ${SANS}`, 36, 22)
  ctx.fillText(d.college, 80, 508)

  label(ctx, 'Branch · Batch', 80, 568)
  ctx.font = `600 36px ${SANS}`
  ctx.fillText(`${d.branch} · Class of ${d.gradYear}`, 80, 614)

  label(ctx, 'Roll no. (your invite code)', 80, 674)
  ctx.font = `700 44px ${MONO}`
  ctx.fillStyle = frame
  ctx.fillText(d.code, 80, 726)

  // Photo box
  ctx.save()
  ctx.setLineDash([10, 8])
  ctx.strokeStyle = C.ink2
  ctx.lineWidth = 2
  ctx.strokeRect(744, 326, 256, 290)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = C.blue
  ctx.font = `700 112px ${HAND}`
  ctx.fillText(d.specimen ? '?' : initials(d.name), 872, 490)
  ctx.font = `400 23px ${HAND}`
  ctx.fillStyle = C.ink2
  ctx.fillText('photo optional.', 872, 566)
  ctx.fillText('skills mandatory.', 872, 594)

  label(ctx, 'Seat no.', 744, 668)
  ctx.textAlign = 'left'
  ctx.fillStyle = C.red
  ctx.font = `800 76px ${DISPLAY}`
  const seatText = d.seat ? String(d.seat).padStart(4, '0') : '----'
  ctx.fillText(seatText, 742, 734)
  const seatW = ctx.measureText(seatText).width
  ctx.font = `600 26px ${SANS}`
  ctx.fillStyle = C.ink2
  ctx.fillText(d.seat && d.seat > 500 ? 'waitlist' : '/ 500', 752 + seatW, 734)

  // Info strip
  const stripY = 770
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 2
  ctx.strokeRect(80, stripY, TICKET_W - 160, 118)
  const cols = [
    { l: 'Date · Time', a: formatDay(d.workshopAt), b: `${formatTime(d.workshopAt)} IST · 60 min` },
    { l: 'Exam centre', a: 'Online', b: 'Your laptop + Chrome' },
    { l: 'Subject', a: 'AI Project Building', b: '(Practical)' },
  ]
  const colW = (TICKET_W - 160) / 3
  cols.forEach((c, i) => {
    const x = 80 + i * colW
    if (i) ctx.fillRect(x, stripY, 2, 118)
    label(ctx, c.l, x + 22, stripY + 36)
    ctx.fillStyle = C.ink
    fitFont(ctx, c.a, colW - 40, (s) => `700 ${s}px ${SANS}`, 28, 18)
    ctx.fillText(c.a, x + 22, stripY + 74)
    fitFont(ctx, c.b, colW - 40, (s) => `500 ${s}px ${SANS}`, 22, 15)
    ctx.fillStyle = C.ink2
    ctx.fillText(c.b, x + 22, stripY + 104)
    ctx.fillStyle = C.ink
  })

  // Instructions
  label(ctx, 'Instructions to candidates', 80, 940, C.ink)
  ctx.font = `500 24px ${SANS}`
  ctx.fillStyle = C.ink
  ;[
    '1. No prior AI knowledge required. A laptop and Chrome are enough.',
    '2. Copying from your batchmates is encouraged. Bring them.',
    '3. Certificate is issued when you submit your live project URL.',
    '4. Late entry permitted. Leaving without shipping is not.',
  ].forEach((line, i) => ctx.fillText(line, 80, 980 + i * 34))

  // QR → referral link
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, d.link, { margin: 1, width: 176, errorCorrectionLevel: 'M', color: { dark: C.ink, light: '#FFFFFF' } })
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(76, 1096, 184, 184)
  ctx.drawImage(qr, 80, 1100, 176, 176)
  ctx.fillStyle = C.blue
  ctx.font = `700 31px ${HAND}`
  ctx.fillText('Bring your batch →', 284, 1150)
  ctx.font = `500 21px ${SANS}`
  ctx.fillStyle = C.ink2
  ctx.fillText('Scan to claim the', 286, 1186)
  ctx.fillText('seat next to mine.', 286, 1214)
  if (d.refCount > 0) {
    ctx.save()
    ctx.translate(286, 1258)
    ctx.rotate(-0.04)
    ctx.fillStyle = C.red
    ctx.font = `700 27px ${HAND}`
    ctx.fillText(`+${d.refCount} joined ✓`, 0, 0)
    ctx.restore()
  }

  // Signature
  signature(ctx, 560, 1214)
  ctx.fillStyle = C.ink
  ctx.fillRect(556, 1228, 230, 2)
  label(ctx, 'Controller of Builds', 556, 1258)

  if (d.stamp !== false && !d.specimen) drawStamp(ctx, STAMP_POS.x * TICKET_W, STAMP_POS.y * TICKET_H, STAMP_POS.r * TICKET_W, formatDay(d.workshopAt).toUpperCase())

  if (d.specimen) {
    ctx.save()
    ctx.translate(TICKET_W / 2, 560)
    ctx.rotate(-0.42)
    ctx.textAlign = 'center'
    ctx.font = `800 170px ${DISPLAY}`
    ctx.lineWidth = 5
    ctx.strokeStyle = 'rgba(217, 58, 43, 0.38)'
    spacing(ctx, 8)
    ctx.strokeText('SPECIMEN', 0, 0)
    ctx.restore()
  }

  return canvas
}

export function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render ticket'))), 'image/png'))
}
