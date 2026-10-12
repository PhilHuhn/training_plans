import Link from 'next/link'
import type { ReactNode } from 'react'
import SupportLink from '@/components/support-link'
import { cn } from '@/lib/utils'
import { site } from '@/lib/site'

// Pages that have to be reachable without logging in live outside the (app)
// group and carry this masthead and colophon rather than the authenticated
// shell.
export default function PublicShell({
  width,
  numbered = false,
  children,
}: {
  /** `prose` for running text, `wide` for tables. */
  width: 'prose' | 'wide'
  /** Auto-number every h2/h3 (see `main.tex-numbered` in globals.css). */
  numbered?: boolean
  children: ReactNode
}) {
  const column = width === 'prose' ? 'max-w-3xl' : 'max-w-5xl'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="frosted sticky top-0 z-30 flex items-center justify-between border-b border-foreground/15 px-6 py-3.5 lg:px-11">
        <Link href="/" className="flex items-baseline gap-2.5 no-underline hover:no-underline">
          <span className="tt-title text-[19px] text-foreground">{site.name}</span>
          <span className="smallcaps hidden text-xs italic text-muted-foreground sm:inline">
            manual, ed. 2026
          </span>
        </Link>
        <Link
          href="/"
          className="smallcaps text-[13px] italic text-foreground no-underline hover:underline"
        >
          Back to the front page
        </Link>
      </div>

      <main
        className={cn('mx-auto px-6 py-14 lg:px-8 lg:py-20', column, numbered && 'tex-numbered')}
      >
        {children}
      </main>

      <div className="px-6 pb-10 lg:px-11">
        <div
          className={cn(
            'mx-auto flex flex-col gap-2 border-t border-foreground/20 pt-4 text-[13px] italic text-muted-foreground sm:flex-row sm:justify-between',
            column,
          )}
        >
          <span>
            {site.name} — {site.operator.city}, 2026
          </span>
          <span className="flex flex-wrap gap-4">
            <SupportLink>Ko-fi</SupportLink>
            <Link href="/bsv">BSV-Kalender</Link>
            <Link href="/imprint">Impressum</Link>
            <Link href="/privacy">Datenschutz</Link>
            <Link href="/contact">Kontakt</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
