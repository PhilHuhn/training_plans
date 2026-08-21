'use client'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useMyClubs, useUpdateMembership } from '@/hooks/use-club'
import type { ClubVisibility } from '@/lib/types'

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  captain: 'Captain',
  athlete: 'Athlet:in',
}

/**
 * Settings card for club membership: shows role, lets the member choose what
 * teammates see (visibility). Renders nothing for solo users.
 */
export default function ClubSettingsCard() {
  const { data: memberships } = useMyClubs()
  const club = memberships?.[0]
  const updateMembership = useUpdateMembership(club?.slug)

  if (!club) return null

  const setVisibility = (visibility: ClubVisibility) => {
    updateMembership.mutate(
      { visibility },
      {
        onSuccess: () => toast.success('Sichtbarkeit aktualisiert'),
        onError: () => toast.error('Sichtbarkeit konnte nicht gespeichert werden'),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Verein</CardTitle>
        <CardDescription>
          {club.name} — deine Rolle: {ROLE_LABEL[club.role] ?? club.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Sichtbarkeit für Teamkolleg:innen</Label>
          <p className="text-xs text-muted-foreground">
            „Nur Typ" teilt Verfügbarkeit und Einheiten-Typ; Paces und Targets bleiben privat.
            Coaches sehen immer alles.
          </p>
          <div className="flex gap-0 border border-foreground/20 w-fit">
            {(
              [
                ['typ_only', 'Nur Typ'],
                ['full', 'Alles'],
              ] as [ClubVisibility, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setVisibility(value)}
                disabled={updateMembership.isPending}
                className={
                  club.visibility === value
                    ? 'bg-foreground px-3 py-1.5 text-xs text-background'
                    : 'px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:text-foreground'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
