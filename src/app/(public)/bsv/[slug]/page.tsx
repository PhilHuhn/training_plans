import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ATHLETICON_INDEX_URL, athleticonDocumentUrl } from '@/lib/athleticon'
import { fetchAthleticonCalendar } from '@/server/services/athleticon'
import { formatDateTime, formatDay } from '../format'

export const revalidate = 1800

// Not indexed: the page is a frame around somebody else's PDF and disappears
// once the event has passed.
export const metadata: Metadata = {
  title: 'Ausschreibung — BSV-Wettkampfkalender',
  robots: { index: false },
}

export default async function BsvEventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  let events
  try {
    events = (await fetchAthleticonCalendar()).events
  } catch (err) {
    console.error('[bsv] calendar fetch failed', err)
    return (
      <div className="border border-foreground/30 px-6 py-8 text-center">
        <p className="tt-title m-0 text-xl">Der Kalender des BSV ist gerade nicht erreichbar.</p>
        <p className="mt-2 text-sm italic text-muted-foreground">
          Die Ausschreibungen stehen weiterhin{' '}
          <a href={ATHLETICON_INDEX_URL} target="_blank" rel="noopener noreferrer">
            direkt im Portal des BSV
          </a>
          .
        </p>
      </div>
    )
  }

  const event = events.find((e) => e.slug === slug)
  if (!event?.documentPath) notFound()

  const proxied = `/api/bsv/document?path=${encodeURIComponent(event.documentPath)}`
  const original = athleticonDocumentUrl(event.documentPath)

  return (
    <>
      <Link href="/bsv" className="smallcaps text-xs italic text-muted-foreground">
        ← Wettkampfkalender
      </Link>
      <h1 className="tt-display mt-1 text-3xl font-normal leading-tight lg:text-4xl">
        {event.title}
      </h1>
      <div className="mt-2 flex flex-col gap-x-6 gap-y-1 text-sm tabular-nums text-muted-foreground sm:flex-row sm:flex-wrap">
        <span>{formatDay(event.date)}</span>
        {event.entryDeadline && <span>Meldeschluss {formatDateTime(event.entryDeadline)}</span>}
        {event.updatedAt && <span>Stand {formatDateTime(event.updatedAt)}</span>}
      </div>

      <div className="rule-top mt-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 pt-3 text-sm">
        <span className="smallcaps italic text-muted-foreground">Ausschreibung</span>
        <a href={original} target="_blank" rel="noopener noreferrer">
          Original beim BSV öffnen
        </a>
      </div>
      <object
        data={proxied}
        type="application/pdf"
        aria-label={`Ausschreibung ${event.title}`}
        className="mt-3 h-[80vh] w-full border border-foreground/30 bg-card"
      >
        <p className="p-6 text-sm italic text-muted-foreground">
          Dieser Browser zeigt PDFs nicht eingebettet an. <a href={proxied}>Ausschreibung öffnen</a>
        </p>
      </object>
    </>
  )
}
