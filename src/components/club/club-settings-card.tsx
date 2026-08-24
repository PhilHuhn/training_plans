'use client'
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useClub, useLeaveClub, useMyClubs, useUpdateMembership } from '@/hooks/use-club'
import type { ClubSummary, ClubVisibility } from '@/lib/types'

const ROLE_LABEL: Record<string, string> = {
  coach: 'Coach',
  captain: 'Captain',
  athlete: 'Athlete',
}

const VISIBILITIES: [ClubVisibility, string][] = [
  ['typ_only', 'Type only'],
  ['full', 'Everything'],
]

function apiMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

/**
 * Settings card for club membership: role, what teammates see, the join code
 * (coaches only) and leaving. Renders nothing for solo users — the way into a
 * club is the /club page, not here.
 */
export default function ClubSettingsCard() {
  const { data: memberships } = useMyClubs()

  if (!memberships?.length) return null

  return (
    <>
      {memberships.map((club) => (
        <ClubMembershipCard key={club.slug} club={club} />
      ))}
    </>
  )
}

function ClubMembershipCard({ club }: { club: ClubSummary }) {
  const { data: detail } = useClub(club.slug)
  const updateMembership = useUpdateMembership(club.slug)
  const leaveClub = useLeaveClub()
  const [copied, setCopied] = useState(false)

  // The API only sends join_code to coaches — they are the ones who hand it out.
  const joinCode = detail?.join_code

  const copyCode = async () => {
    if (!joinCode) return
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the code and copy it manually')
    }
  }

  const setVisibility = (visibility: ClubVisibility) => {
    updateMembership.mutate(
      { visibility },
      {
        onSuccess: () => toast.success('Visibility updated'),
        onError: () => toast.error('Could not save visibility'),
      },
    )
  }

  const leave = () => {
    if (!confirm(`Leave ${club.name}? Your own training stays untouched.`)) return
    leaveClub.mutate(club.slug, {
      onSuccess: () => toast.success(`You left ${club.name}`),
      onError: (err) => toast.error(apiMessage(err, 'Could not leave the club')),
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Club</CardTitle>
        <CardDescription>
          {club.name} — your role: {ROLE_LABEL[club.role] ?? club.role}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label>Visibility to teammates</Label>
          <p className="text-xs text-muted-foreground">
            “Type only” shares availability and session type; paces and targets stay private.
            Coaches always see everything.
          </p>
          <div className="flex w-fit gap-0 border border-foreground/20">
            {VISIBILITIES.map(([value, label]) => (
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

        {joinCode && (
          <div className="space-y-1.5">
            <Label>Join code</Label>
            <p className="text-xs text-muted-foreground">
              Share this with teammates so they can join. Anyone with the code can join as an
              athlete.
            </p>
            <div className="flex w-fit items-center gap-2 border border-foreground/20 px-3 py-1.5">
              <code className="font-mono text-sm tracking-widest">{joinCode}</code>
              <button
                onClick={copyCode}
                aria-label="Copy join code"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-foreground/15 pt-3">
          <Button variant="outline" size="sm" onClick={leave} disabled={leaveClub.isPending}>
            {leaveClub.isPending ? 'Leaving …' : 'Leave club'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
