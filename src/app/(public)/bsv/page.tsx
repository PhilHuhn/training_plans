import Link from 'next/link'
import type { Metadata } from 'next'
import AdoptLink from '@/components/bsv/adopt-link'
import { ATHLETICON_INDEX_URL, type AthleticonEvent } from '@/lib/athleticon'
import { fetchAthleticonCalendar, type AthleticonCalendar } from '@/server/services/athleticon'
import { berlinNow, daysBetween, formatDateTime, formatDay, formatMonth } from './format'

// Re-rendered at most every 30 minutes, in step with the cached upstream fetch.
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'BSV-Wettkampfkalender — Club Turbine',
  description:
    'Die Leichtathletik-Termine und Ausschreibungen des Betriebssportverbands Hamburg, übersichtlich gesetzt.',
}

const EMPTY = '—'

function PortalLink({ children }: { children: React.ReactNode }) {
  return (
    <a href={ATHLETICON_INDEX_URL} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  )
}

function Deadline({ event, now }: { event: AthleticonEvent; now: string }) {
  if (!event.entryDeadline) return <>{EMPTY}</>
  const passed = event.entryDeadline < now
  return (
    <span className={passed ? 'text-muted-foreground' : undefined}>
      {formatDateTime(event.entryDeadline)}
      {passed && <span className="smallcaps whitespace-nowrap italic"> (abgelaufen)</span>}
    </span>
  )
}

function Actions({ event }: { event: AthleticonEvent }) {
  return (
    <>
      {event.documentPath && <Link href={`/bsv/${event.slug}`}>Ausschreibung</Link>}
      {event.registrationUrl && (
        <a
          href={event.registrationUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Gäste melden sich im Portal des BSV an. Betriebssportler wenden sich an ihre Spartenleitung."
        >
          Anmeldung für Gäste
        </a>
      )}
      <AdoptLink title={event.title} date={event.date} />
    </>
  )
}

function Title({ event }: { event: AthleticonEvent }) {
  return event.documentPath ? (
    <Link href={`/bsv/${event.slug}`} className="text-foreground">
      {event.title}
    </Link>
  ) : (
    <>{event.title}</>
  )
}

export default async function BsvCalendarPage() {
  let calendar: AthleticonCalendar | null = null
  try {
    calendar = await fetchAthleticonCalendar()
  } catch (err) {
    console.error('[bsv] calendar fetch failed', err)
  }

  const now = berlinNow()
  const today = now.slice(0, 10)
  const events = calendar?.events ?? []
  const next = events.find((e) => e.date >= today)
  const daysToNext = next ? daysBetween(today, next.date) : 0

  const months = new Map<string, AthleticonEvent[]>()
  for (const event of events) {
    const key = event.date.slice(0, 7)
    months.set(key, [...(months.get(key) ?? []), event])
  }

  return (
    <>
      <div className="smallcaps text-xs italic text-muted-foreground">
        Betriebssportverband Hamburg · Leichtathletik
      </div>
      <h1 className="tt-display mt-1 text-4xl font-normal leading-tight lg:text-5xl">
        Wettkampfkalender
      </h1>

      <div className="rule-top rule-bottom mx-auto mt-8 max-w-3xl px-1 py-6 sm:px-6 lg:px-10">
        <p className="prose-paper m-0 text-base leading-[1.6]">
          Die Termine und Ausschreibungen stammen aus <PortalLink>Athleticon</PortalLink>, dem
          Onlineportal des BSV Hamburg, und werden hier unverändert wiedergegeben; maßgeblich
          bleibt das Original. Meldelisten und Ergebnisse finden sich nur dort.
          {calendar && (
            <>
              {' '}
              Zuletzt abgerufen am {formatDateTime(berlinNow(calendar.fetchedAt))}.
            </>
          )}
        </p>
      </div>

      {!calendar ? (
        <div className="mt-10 border border-foreground/30 px-6 py-8 text-center">
          <p className="tt-title m-0 text-xl">
            Der Kalender des BSV ist gerade nicht erreichbar.
          </p>
          <p className="mt-2 text-sm italic text-muted-foreground">
            Die Termine stehen weiterhin <PortalLink>direkt im Portal des BSV</PortalLink>.
          </p>
        </div>
      ) : events.length === 0 ? (
        <p className="mt-10 text-center italic text-muted-foreground">
          Derzeit sind keine Wettkämpfe ausgeschrieben. Zum Vergleich:{' '}
          <PortalLink>das Portal des BSV</PortalLink>.
        </p>
      ) : (
        <>
          {next && (
            <div className="wash-primary mt-10 flex flex-col gap-4 border border-foreground/20 p-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="smallcaps text-[11.5px] italic text-muted-foreground">
                  Nächster Termin
                </div>
                <div className="tt-title mt-1 text-xl">
                  <Title event={next} />
                </div>
                <div className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {formatDay(next.date)}
                  {next.entryDeadline && (
                    <> · Meldeschluss {formatDateTime(next.entryDeadline)}</>
                  )}
                </div>
              </div>
              <div className="tt-display whitespace-nowrap text-3xl tabular-nums">
                {daysToNext === 0
                  ? 'heute'
                  : daysToNext === 1
                    ? 'morgen'
                    : `in ${daysToNext} Tagen`}
              </div>
            </div>
          )}

          {[...months].map(([key, monthEvents]) => (
            <section key={key} className="mt-12">
              <h2 className="smallcaps m-0 text-[15px] font-normal italic">
                {formatMonth(monthEvents[0].date)}
              </h2>

              {/* md and up: a booktabs table */}
              <table className="booktabs-top booktabs-bottom mt-3 hidden w-full border-collapse text-[15px] md:table">
                <thead>
                  <tr className="booktabs-mid text-left">
                    <th className="w-[9.5rem] py-2 pr-4 font-normal italic">Datum</th>
                    <th className="py-2 pr-4 font-normal italic">Wettkampf</th>
                    <th className="w-[13rem] py-2 pr-4 font-normal italic">Meldeschluss</th>
                    <th className="w-[15rem] py-2 font-normal italic">
                      Ausschreibung / Anmeldung
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthEvents.map((event) => (
                    <tr key={event.slug} className="align-baseline">
                      <td className="whitespace-nowrap py-2 pr-4 tabular-nums">
                        {formatDay(event.date)}
                      </td>
                      <td className="py-2 pr-4">
                        <Title event={event} />
                      </td>
                      <td className="py-2 pr-4 tabular-nums">
                        <Deadline event={event} now={now} />
                      </td>
                      <td className="py-2 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <Actions event={event} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* below md: one card per event instead of a sideways-scrolling table */}
              <ul className="booktabs-top booktabs-bottom mt-3 list-none divide-y divide-foreground/15 p-0 md:hidden">
                {monthEvents.map((event) => (
                  <li key={event.slug} className="py-3.5">
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {formatDay(event.date)}
                    </div>
                    <div className="tt-title mt-0.5 text-lg leading-snug">
                      <Title event={event} />
                    </div>
                    <div className="mt-1 text-sm tabular-nums">
                      <span className="smallcaps italic text-muted-foreground">Meldeschluss </span>
                      <Deadline event={event} now={now} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <Actions event={event} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  )
}
