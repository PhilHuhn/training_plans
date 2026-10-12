// Date helpers for the BSV calendar. The portal's dates are Hamburg wall-clock
// values without a zone, so they are formatted as written and compared against
// "now in Berlin" as strings — never run through the server's own time zone.

const day = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})
const month = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const berlin = new Intl.DateTimeFormat('sv-SE', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
})

const utc = (isoDate: string) => new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)

/** `2026-10-17` → `Sa., 17.10.2026` */
export const formatDay = (isoDate: string) => day.format(utc(isoDate))

/** `2026-10-17` → `Oktober 2026` */
export const formatMonth = (isoDate: string) => month.format(utc(isoDate))

/** `2026-10-14T18:00` → `14.10.2026, 18:00 Uhr` */
export function formatDateTime(iso: string): string {
  const [date, time] = iso.split('T')
  const [y, m, d] = date.split('-')
  return time ? `${d}.${m}.${y}, ${time} Uhr` : `${d}.${m}.${y}`
}

/** The current Hamburg time in the portal's own shape, `YYYY-MM-DDTHH:MM`. */
export const berlinNow = (at: Date = new Date()) => berlin.format(at).replace(' ', 'T')

export const daysBetween = (fromIsoDate: string, toIsoDate: string) =>
  Math.round((utc(toIsoDate).getTime() - utc(fromIsoDate).getTime()) / 86_400_000)
