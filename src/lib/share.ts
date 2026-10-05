import { WORKSHOP_TITLE } from '../config'
import { formatDay, formatTime, HOUR } from './time'
import { shareLink } from './attribution'
import type { Seat } from '../types'

export function whatsappMessage(seat: Seat): string {
  return [
    `Got my hall ticket 🎟️ for a FREE live workshop: *${WORKSHOP_TITLE}*.`,
    `Any branch, no AI background needed. We build AND deploy a real AI project, plus a certificate.`,
    `I'm seat #${seat.seat} of 500. Claim the seat next to mine 👇`,
    shareLink(seat.code),
  ].join('\n\n')
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`

export const linkedinUrl = (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`

const icsDate = (t: number) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

export function googleCalendarUrl(workshopAt: number): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `AI60 · ${WORKSHOP_TITLE}`,
    dates: `${icsDate(workshopAt)}/${icsDate(workshopAt + HOUR)}`,
    details: 'Free live build-along by NxtWave. Bring a laptop with Chrome. The joining link arrives on WhatsApp 1 hour before.',
    location: 'Online',
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

export function downloadIcs(workshopAt: number) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AI60//Hall Ticket//EN',
    'BEGIN:VEVENT',
    `UID:ai60-${workshopAt}@ai60`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(workshopAt)}`,
    `DTEND:${icsDate(workshopAt + HOUR)}`,
    `SUMMARY:AI60 · ${WORKSHOP_TITLE}`,
    'DESCRIPTION:Free live build-along. Bring a laptop with Chrome. Joining link arrives on WhatsApp 1 hour before.',
    'LOCATION:Online',
    'BEGIN:VALARM',
    'TRIGGER:-PT60M',
    'ACTION:DISPLAY',
    'DESCRIPTION:AI60 starts in 1 hour',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  downloadBlob(new Blob([ics], { type: 'text/calendar' }), 'ai60-workshop.ics')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export const workshopWhen = (t: number) => `${formatDay(t)} · ${formatTime(t)} IST`
