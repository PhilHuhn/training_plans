'use client'
import { useState } from 'react'
import { KeyRound, Plus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateClub, useJoinClub } from '@/hooks/use-club'

/** Pull the API's `{detail}` message off an axios error, with a fallback. */
function apiMessage(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
  return typeof detail === 'string' && detail ? detail : fallback
}

/**
 * The way into a club for a user who isn't in one yet. Until this existed,
 * memberships could only be created by the seed script, so a registered user
 * was permanently solo.
 */
export default function ClubOnboarding() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const createClub = useCreateClub()
  const joinClub = useJoinClub()

  const submitCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed.length < 2) return
    createClub.mutate(trimmed, {
      onSuccess: (club) => {
        setName('')
        toast.success(`${club.name} created — your join code is ${club.join_code}`)
      },
      onError: (err) => toast.error(apiMessage(err, 'Could not create the club')),
    })
  }

  const submitJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim()
    if (trimmed.length < 4) return
    joinClub.mutate(trimmed, {
      onSuccess: (club) => {
        setCode('')
        toast.success(`You joined ${club.name}`)
      },
      onError: (err) => toast.error(apiMessage(err, 'Could not join that club')),
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 text-center">
        <Users className="mx-auto mb-4 h-8 w-8 text-muted-foreground/50" />
        <h2 className="mb-2 font-serif text-lg">You&rsquo;re not in a club yet</h2>
        <p className="prose-paper mx-auto max-w-prose text-sm italic text-muted-foreground">
          A club overlays your week on your teammates&rsquo; — it finds the sessions you could run
          together and the ones that merely happen at the same time, without compromising anyone&rsquo;s
          own training stimulus.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Start a club
            </CardTitle>
            <CardDescription>
              You become its coach and get a code to hand to your teammates.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitCreate} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="club-name">Club name</Label>
                <Input
                  id="club-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Turmweg Runners"
                  maxLength={255}
                />
              </div>
              <Button type="submit" disabled={createClub.isPending || name.trim().length < 2}>
                {createClub.isPending ? 'Creating …' : 'Create club'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4" />
              Join a club
            </CardTitle>
            <CardDescription>
              Ask a coach for the club&rsquo;s code. Joining never widens what teammates can see of
              your training.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitJoin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="join-code">Join code</Label>
                <Input
                  id="join-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD2345"
                  maxLength={12}
                  className="font-mono tracking-widest"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={joinClub.isPending || code.trim().length < 4}
              >
                {joinClub.isPending ? 'Joining …' : 'Join club'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
