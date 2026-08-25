'use client'
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-auth'
import { GETTING_STARTED_TOUR_ID } from '@/lib/tour-steps'
import { useTour } from './tour-provider'

/**
 * Opens the getting-started tour once, on the first visit to /training after
 * registering.
 *
 * Gated on the server-recorded `tours_done` rather than localStorage, so it
 * does not replay on a second device. Waits for the user query to resolve —
 * firing before it lands would show the tour to someone who has already
 * dismissed it.
 */
export default function TourAutostart() {
  const pathname = usePathname()
  const { data: user, isSuccess } = useCurrentUser()
  const tour = useTour()
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current || !isSuccess || !user) return
    if (pathname !== '/training') return

    const onboarding = user.preferences?.onboarding
    // Never seen /welcome at all: an account from before onboarding existed.
    // Starting a tour unprompted for them would be an ambush.
    if (!onboarding?.welcomed_at) return
    if (onboarding.tours_done?.includes(GETTING_STARTED_TOUR_ID)) return

    fired.current = true
    tour.start(GETTING_STARTED_TOUR_ID)
  }, [isSuccess, user, pathname, tour])

  return null
}
