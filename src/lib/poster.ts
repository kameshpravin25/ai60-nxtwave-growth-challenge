import QRCode from 'qrcode'
import { C, DISPLAY, HAND, MONO, SANS, ensureFonts, fitFont, label, securityPattern, spacing } from './ticket'
import { formatLongDay, formatTime } from './time'

export const POSTER_W = 1240
export const POSTER_H = 1754

/** A4 notice-board poster for a Campus Captain: their tracked link as a big QR. */
export async function renderPoster(opts: { link: string; college: string; captain: string; workshopAt: number }): Promise<HTMLCanvasElement> {
  await ensureFonts()
  const canvas = document.createElement('canvas')
  canvas.width = POSTER_W
  canvas.height = POSTER_H
  const ctx = canvas.getContext('2d')!
  const cx = POSTER_W / 2

  ctx.fillStyle = '#FFFDF5'
  ctx.fillRect(0, 0, POSTER_W, POSTER_H)
  securityPattern(ctx, POSTER_W, POSTER_H)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 6
  ctx.strokeRect(40, 40, POSTER_W - 80, POSTER_H - 80)

  ctx.textAlign = 'center'
  ctx.fillStyle = C.red
  ctx.font = `800 64px ${DISPLAY}`
  spacing(ctx, 18)
  ctx.fillText('NOTICE', cx, 150)
  spacing(ctx, 0)
  label(ctx, `Circular No. AI60/2026 · ${opts.college}`, cx, 196)
  ctx.fillStyle = C.ink
  ctx.fillRect(110, 226, POSTER_W - 220, 4)

  ctx.font = `800 104px ${DISPLAY}`
  spacing(ctx, -2)
  ctx.fillText('Build your first', cx, 360)
  ctx.fillStyle = C.blue
  ctx.fillText('AI project', cx, 470)
  ctx.fillStyle = C.ink
  ctx.fillText('in 60 minutes.', cx, 580)
  spacing(ctx, 0)

  ctx.font = `700 34px ${MONO}`
  ctx.fillText(`FREE · LIVE · ONLINE · ${formatTime(opts.workshopAt)} IST`, cx, 660)
  ctx.font = `600 34px ${SANS}`
  ctx.fillStyle = C.ink2
  ctx.fillText(formatLongDay(opts.workshopAt), cx, 708)
  ctx.font = `500 32px ${SANS}`
  ctx.fillText('Any branch · No AI background · Leave with a live project + certificate', cx, 770)

  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, opts.link, { margin: 1, width: 520, errorCorrectionLevel: 'M', color: { dark: C.ink, light: '#FFFFFF' } })
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(cx - 280, 830, 560, 560)
  ctx.strokeStyle = C.ink
  ctx.lineWidth = 3
  ctx.strokeRect(cx - 280, 830, 560, 560)
  ctx.drawImage(qr, cx - 260, 850, 520, 520)

  ctx.fillStyle = C.red
  ctx.font = `700 52px ${HAND}`
  ctx.fillText('Scan → get your hall ticket', cx, 1470)
  ctx.fillStyle = C.ink2
  fitFont(ctx, opts.link.replace(/^https?:\/\//, ''), POSTER_W - 260, (s) => `400 ${s}px ${MONO}`, 26, 16)
  ctx.fillText(opts.link.replace(/^https?:\/\//, ''), cx, 1520)

  ctx.fillStyle = C.ink
  ctx.fillRect(110, 1570, POSTER_W - 220, 2)
  ctx.font = `600 32px ${SANS}`
  fitFont(ctx, `Campus Captain: ${opts.captain}`, POSTER_W - 260, (s) => `600 ${s}px ${SANS}`, 32, 20)
  ctx.fillText(`Campus Captain: ${opts.captain}`, cx, 1628)
  label(ctx, 'Only 500 seats · NxtWave AI60', cx, 1676)
  return canvas
}
