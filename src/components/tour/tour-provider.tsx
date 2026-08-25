'use client'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useCurrentUser } from '@/hooks/use-auth'
import { usePatchOnboarding } from '@/hooks/use-onboarding'
import { tourById, type TourCondition, type TourStep } from '@/lib/tour-steps'
import TourSpotlight from './tour-spotlight'

/** How long to wait for a step's anchor to appear before giving up on it. */
const ANCHOR_TIMEOUT_MS = 2000

interface TourContextValue {
  /** Id of the running tour, or null. */
  activeTour: string | null
  step: TourStep | null
  stepNumber: number
  stepCount: number
  start: (tourId: string) => void
  next: () => void
  back: () => void
  /** End the tour and record it as seen, so it does not re-open. */
  stop: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used inside <TourProvider>')
  return ctx
}

export function findAnchor(anchor: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(`[data-tour="${anchor}"]`)
}

export default function TourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: user } = useCurrentUser()
  const patchOnboarding = usePatchOnboarding()

  const [activeTour, setActiveTour] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [target, setTarget] = useState<HTMLElement | null>(null)

  const definition = activeTour ? tourById(activeTour) : undefined

  // Conditions are resolved here rather than in tour-steps.ts, which stays free
  // of app types. A step whose precondition no longer holds is dropped from the
  // tour entirely, so "step 3 of 6" still counts correctly.
  const conditionHolds = useCallback(
    (condition: TourCondition | undefined) => {
      if (!condition) return true
      if (condition === 'strava-disconnected') return user?.strava_connected !== true
      return true
    },
    [user?.strava_connected],
  )

  const steps = useMemo(
    () => (definition?.steps ?? []).filter((s) => conditionHolds(s.when)),
    [definition, conditionHolds],
  )

  const step = steps[index] ?? null

  const finish = useCallback(
    (tourId: string | null) => {
      setActiveTour(null)
      setIndex(0)
      setTarget(null)
      // Best effort: failing to record a finished tour is a small annoyance,
      // and a toast about it during onboarding would be worse than the bug.
      if (tourId) patchOnboarding.mutate({ tour_done: tourId })
    },
    [patchOnboarding],
  )

  const start = useCallback((tourId: string) => {
    if (!tourById(tourId)) return
    setActiveTour(tourId)
    setIndex(0)
    setTarget(null)
  }, [])

  const stop = useCallback(() => finish(activeTour), [finish, activeTour])

  const next = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= steps.length) {
        // Deferred so the state update that ends the tour does not run inside
        // this updater.
        queueMicrotask(() => finish(activeTour))
        return i
      }
      return i + 1
    })
  }, [steps.length, finish, activeTour])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Navigate to the step's route, then wait for its anchor to mount. The
  // timeout is what stops a missing anchor from parking the user behind a
  // spotlight over nothing — mobile hits this legitimately, since the sidebar
  // is a Sheet and its anchors are not in the DOM at all.
  useEffect(() => {
    if (!step) {
      setTarget(null)
      return
    }
    if (step.route && pathname !== step.route) {
      router.push(step.route)
      return
    }

    let raf = 0
    const deadline = Date.now() + ANCHOR_TIMEOUT_MS
    let cancelled = false

    const look = () => {
      if (cancelled) return
      const el = findAnchor(step.anchor)
      if (el) {
        setTarget(el)
        el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        return
      }
      if (Date.now() > deadline) {
        setTarget(null)
        next()
        return
      }
      raf = requestAnimationFrame(look)
    }
    look()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
    // `next` is stable per step set; including it would restart the search on
    // every index change, which is exactly what we want here anyway.
  }, [step, pathname, router, next])

  // Escape ends the tour; arrows step. Bound only while a tour runs so the
  // shortcuts never interfere with normal typing.
  useEffect(() => {
    if (!activeTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeTour, stop, next, back])

  const value = useMemo<TourContextValue>(
    () => ({
      activeTour,
      step,
      stepNumber: index + 1,
      stepCount: steps.length,
      start,
      next,
      back,
      stop,
    }),
    [activeTour, step, index, steps.length, start, next, back, stop],
  )

  return (
    <TourContext.Provider value={value}>
      {children}
      {step && target && (
        <TourSpotlight
          target={target}
          step={step}
          stepNumber={index + 1}
          stepCount={steps.length}
          onNext={next}
          onBack={back}
          onStop={stop}
        />
      )}
    </TourContext.Provider>
  )
}
