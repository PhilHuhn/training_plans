'use client'
import type { SponsorWire } from '@/lib/types'

/**
 * Sponsor slot (paid tier) and/or "Powered by" line (free tier). Rendered at
 * the bottom of the club page in a booktabs-style box.
 */
export default function SponsorFooter({
  sponsor,
  poweredBy,
}: {
  sponsor: SponsorWire | null
  poweredBy: boolean
}) {
  if (!sponsor && !poweredBy) return null
  return (
    <footer className="mt-8 border-t-2 border-b border-foreground/40 py-3 text-sm">
      {sponsor && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[11px] italic smallcaps text-muted-foreground">
            Supported by
          </span>
          {sponsor.url ? (
            <a
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-primary hover:underline"
            >
              {sponsor.name}
            </a>
          ) : (
            <span className="font-semibold">{sponsor.name}</span>
          )}
          {sponsor.discount_code && (
            <span className="text-xs text-foreground/80">
              Discount code for club members:{' '}
              <code className="border border-foreground/20 px-1 py-0.5 text-[11px] tabular-nums">
                {sponsor.discount_code}
              </code>
            </span>
          )}
        </div>
      )}
      {poweredBy && (
        <div className="text-[11px] italic text-muted-foreground">
          Powered by Club Turbine
        </div>
      )}
    </footer>
  )
}
