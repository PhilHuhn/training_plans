'use client'
import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Compass, Users, Zap } from 'lucide-react'
import { toast } from 'sonner'
import ClubOnboarding from '@/components/club/club-onboarding'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { stravaApi } from '@/api/strava'
import { useCurrentUser } from '@/hooks/use-auth'
import { useMyClubs } from '@/hooks/use-club'
import { usePatchOnboarding } from '@/hooks/use-onboarding'
import { useTour } from '@/components/tour/tour-provider'
import { GETTING_STARTED_TOUR_ID } from '@/lib/tour-steps'

/** One numbered step, in the same register as the sidebar's table of contents. */
function Step({
  index,
  title,
  description,
  icon: Icon,
  done,
  children,
}: {
  index: number
  title: string
  description: string
  icon: typeof Zap
  done?: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <div className="smallcaps flex items-center gap-2 text-[11.5px] italic text-muted-foreground">
          <span className="tabular-nums">Step {index}</span>
          {done && (
            <span className="inline-flex items-center gap-1 text-accent">
              <Check className="h-3 w-3" /> done
            </span>
          )}
        </div>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function WelcomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: user } = useCurrentUser()
  const { data: clubs } = useMyClubs()
  const patchOnboarding = usePatchOnboarding()
  const tour = useTour()

  const [stravaLoading, setStravaLoading] = useState(false)

  const connected = user?.strava_connected === true
  const inClub = (clubs?.length ?? 0) > 0

  // Record the visit once. A ref rather than a dependency on the mutation
  // object, which is a new identity on every render and would loop.
  const recorded = useRef(false)
  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    patchOnboarding.mutate({ welcomed: true })
  }, [patchOnboarding])

  // The OAuth round trip comes back here now, not to /settings.
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current) return
    const status = searchParams?.get('strava')
    if (!status) return
    reported.current = true
    if (status === 'connected') toast.success('Strava connected — your activities are on the way.')
    else toast.error(`Strava connection failed: ${searchParams?.get('reason') ?? 'unknown error'}`)
  }, [searchParams])

  const connectStrava = async () => {
    setStravaLoading(true)
    try {
      const res = await stravaApi.getAuthUrl('welcome')
      window.location.href = res.data.auth_url
    } catch {
      toast.error('Could not reach Strava just now. You can connect later in Settings.')
      setStravaLoading(false)
    }
  }

  const startTour = () => {
    router.push('/training')
    tour.start(GETTING_STARTED_TOUR_ID)
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-10">
        <div className="smallcaps flex items-center gap-2 text-xs italic text-muted-foreground">
          <span className="inline-block h-px w-5 bg-current" />
          Getting started
        </div>
        <h1 className="tt-title mt-2 text-[32px] leading-[1.1]">
          Welcome{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="prose-paper mt-3 max-w-prose text-sm italic text-muted-foreground">
          Two optional steps and you&rsquo;re set up. You can skip either one and do it later from
          Settings — nothing here blocks you from using the app.
        </p>
      </div>

      <div className="space-y-4">
        <Step
          index={1}
          title="Connect Strava"
          description="Where your completed runs come from. Without it the dashboard, the activity charts and most of what the coach can say stay empty."
          icon={Zap}
          done={connected}
        >
          {connected ? (
            <p className="text-sm italic text-muted-foreground">
              Connected. Your recent activities sync automatically.
            </p>
          ) : (
            <Button size="sm" onClick={connectStrava} disabled={stravaLoading}>
              <Zap className="mr-2 h-4 w-4" />
              {stravaLoading ? 'Connecting …' : 'Connect Strava'}
            </Button>
          )}
        </Step>

        <Step
          index={2}
          title="Join or start a club"
          description="A club overlays your training week on your teammates’ and finds the sessions you could actually run together. Joining never widens what they can see of your training."
          icon={Users}
          done={inClub}
        >
          {inClub ? (
            <p className="text-sm italic text-muted-foreground">
              You&rsquo;re in {clubs?.length === 1 ? clubs[0].name : `${clubs?.length} clubs`}.
            </p>
          ) : (
            <ClubOnboarding compact />
          )}
        </Step>
      </div>

      <div className="booktabs-top mt-8 flex flex-wrap items-center gap-3 border-foreground/20 pt-5">
        <Button onClick={startTour}>
          <Compass className="mr-2 h-4 w-4" />
          Show me around
        </Button>
        <Link
          href="/training"
          className="inline-flex items-center gap-1.5 text-sm italic text-muted-foreground hover:text-foreground"
        >
          Skip for now
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}

export default function WelcomePage() {
  // useSearchParams needs a Suspense boundary to keep this page prerenderable.
  return (
    <Suspense fallback={null}>
      <WelcomeContent />
    </Suspense>
  )
}
