'use client'
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
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

function formatWeekRange(weekStart: string): string {
  const fmt = (iso: string) => {
    const d = new Date(`${iso}T00:00:00Z`)
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.`
  }
  return `${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}`
}

export default function ClubPage() {
  const { data: memberships, isLoading: clubsLoading } = useMyClubs()
  const club = memberships?.[0]
  const [weekStart, setWeekStart] = useState(currentMonday)

  const { data: detail } = useClub(club?.slug)
  const { data: overlay, isLoading: overlayLoading } = useClubOverlay(club?.slug, weekStart)

  const weekLabel = useMemo(() => formatWeekRange(weekStart), [weekStart])

  if (clubsLoading) {
    return <div className="p-8 text-sm italic text-muted-foreground">Lade Verein …</div>
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
        <h2 className="mb-2 text-lg font-serif">Du bist in keinem Verein</h2>
        <p className="text-sm italic text-muted-foreground">
          Sobald du Mitglied eines Vereins bist, findet das Overlay hier gemeinsame und
          parallele Einheiten mit deinen Teamkolleg:innen — ohne deinen Trainingsreiz zu
          kompromittieren.
        </p>
      </div>
    )
  }

  return (
    <ThemeScope theme={detail?.theme}>
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      {/* Club header */}
      <section className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-foreground/30 pb-3">
        <div>
          <h2 className="text-xl font-serif leading-tight">{club.name}</h2>
          <p className="text-xs italic text-muted-foreground">
            Vereins-Overlay · deine Rolle: {club.role}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {detail?.donation_url && (
            <a
              href={detail.donation_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-foreground/30 px-3 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary"
            >
              Spendier mir ne Club-Mate 🧉
            </a>
          )}
          <div className="flex items-center border border-foreground/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none px-2"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              aria-label="Vorherige Woche"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs tabular-nums">{weekLabel}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 rounded-none px-2"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              aria-label="Nächste Woche"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Overlay grid */}
      {overlayLoading && (
        <div className="py-12 text-center text-sm italic text-muted-foreground">
          Berechne Overlaps …
        </div>
      )}
      {overlay && overlay.rows.length > 0 && <ClubOverlayGrid data={overlay} />}
      {overlay && overlay.rows.length === 0 && (
        <div className="py-12 text-center text-sm italic text-muted-foreground">
          Noch keine Mitglieder mit Plänen in dieser Woche.
        </div>
      )}

      <SponsorFooter sponsor={detail?.sponsor ?? null} poweredBy={detail?.powered_by ?? false} />
    </div>
    </ThemeScope>
  )
}
