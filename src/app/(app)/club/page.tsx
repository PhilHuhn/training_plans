'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ClubOnboarding from '@/components/club/club-onboarding'
import ClubOverlayGrid from '@/components/club/club-overlay-grid'
import SponsorFooter from '@/components/club/sponsor-footer'
import ThemeScope from '@/components/club/theme-scope'
import { Button } from '@/components/ui/button'
import { useClub, useClubOverlay, useMyClubs } from '@/hooks/use-club'
import { addDays } from '@/lib/utils'

const DAY_MS = 24 * 3600 * 1000

/** Monday (YYYY-MM-DD) of the week containing today, in local time. */
function currentMonday(): string {
  const now = new Date()
  const utc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const dow = (new Date(utc).getUTCDay() + 6) % 7
  return new Date(utc - dow * DAY_MS).toISOString().slice(0, 10)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatWeekRange(weekStart: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`
  }
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`
}

export default function ClubPage() {
  const { data: memberships, isLoading: clubsLoading } = useMyClubs()
  // Users can now belong to several clubs; the switcher below picks between them.
  const [activeSlug, setActiveSlug] = useState<string | null>(null)
  const club = memberships?.find((m) => m.slug === activeSlug) ?? memberships?.[0]
  const [weekStart, setWeekStart] = useState(currentMonday)

  const { data: detail } = useClub(club?.slug)
  const { data: overlay, isLoading: overlayLoading } = useClubOverlay(club?.slug, weekStart)

  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart])

  if (clubsLoading) {
    return <div className="p-8 text-sm italic text-muted-foreground">Loading club …</div>
  }

  if (!club) return <ClubOnboarding />

  return (
    <ThemeScope theme={detail?.theme}>
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Club header */}
      <section className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-foreground/30 pb-3">
        <div>
          <h2 className="text-xl font-serif leading-tight">{club.name}</h2>
          <p className="text-xs italic text-muted-foreground">
            Club overlay · your role: {club.role}
          </p>
          {memberships && memberships.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {memberships.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => setActiveSlug(m.slug)}
                  className={
                    m.slug === club.slug
                      ? 'border-b border-foreground text-xs'
                      : 'border-b border-transparent text-xs text-muted-foreground transition-colors hover:text-foreground'
                  }
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {detail?.donation_url && (
            <a
              href={detail.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-foreground/30 px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary"
            >
              Buy me a Club-Mate 🧉
            </a>
          )}
          <div className="flex items-center border border-foreground/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none px-2"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Previous week"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs tabular-nums">{weekLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none px-2"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Next week"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Overlay grid */}
      {overlayLoading && (
        <div className="py-12 text-center text-sm italic text-muted-foreground">
          Computing overlaps …
        </div>
      )}
      {overlay && overlay.rows.length > 0 && <ClubOverlayGrid data={overlay} />}
      {overlay && overlay.rows.length === 0 && (
        <div className="py-12 text-center text-sm italic text-muted-foreground">
          No members with plans for this week yet.
        </div>
      )}

      <SponsorFooter sponsor={detail?.sponsor ?? null} poweredBy={detail?.powered_by ?? false} />
    </div>
    </ThemeScope>
  )
}
