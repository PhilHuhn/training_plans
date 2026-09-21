import Link from 'next/link'
import type { ReactNode } from 'react'
import SupportLink from '@/components/support-link'
import { site } from '@/lib/site'

// The legally required pages have to be reachable without logging in, so they
// live outside the (app) group and carry their own masthead rather than the
// authenticated shell.
export default function LegalLayout({ children }: { children: ReactNode }) {
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

      <main className="tex-numbered mx-auto max-w-3xl px-6 py-14 lg:px-8 lg:py-20">{children}</main>

      <div className="px-6 pb-10 lg:px-11">
        <div className="mx-auto flex max-w-3xl flex-col gap-2 border-t border-foreground/20 pt-4 text-[13px] italic text-muted-foreground sm:flex-row sm:justify-between">
          <span>
            {site.name} — {site.operator.city}, 2026
          </span>
          <span className="flex gap-4">
            <SupportLink>Ko-fi</SupportLink>
            <Link href="/imprint">Impressum</Link>
            <Link href="/privacy">Datenschutz</Link>
            <Link href="/contact">Kontakt</Link>
          </span>
        </div>
      </div>
    </div>
  )
}
