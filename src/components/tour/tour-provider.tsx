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

/**
 * The visible element carrying this anchor, or null.
 *
 * Zero-area elements are rejected, and that is the whole point rather than a
 * nicety: the desktop sidebar is `hidden lg:block`, so on a phone it is still
 * in the DOM and `querySelector` finds it happily. Spotlighting it produced a
 * 12px ring in the corner pointing at nothing. Filtering here is also what lets
 * the timeout-skip below actually fire for those steps.
 *
 * `getClientRects()` is empty for `display:none` and for any ancestor that is
 * display:none, which is exactly the case to exclude.
 */
export function findAnchor(anchor: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour="${anchor}"]`)
  for (const el of candidates) {
    if (el.getClientRects().length === 0) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) continue
    return el
  }
  return null
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
    finishing.current = false
    setActiveTour(tourId)
    setIndex(0)
    setTarget(null)
  }, [])

  const stop = useCallback(() => finish(activeTour), [finish, activeTour])

  // Guards the terminal transition. Two arrow presses in one frame batch into a
  // single render, and React double-invokes updaters under StrictMode — either
  // one would otherwise call finish() twice and fire two concurrent writes.
  const finishing = useRef(false)

  const next = useCallback(() => {
    if (finishing.current) return
    // Read state here rather than inside a setState updater: updaters must be
    // pure, and React runs them speculatively.
    if (index + 1 >= steps.length) {
      finishing.current = true
      finish(activeTour)
      return
    }
    setIndex(index + 1)
  }, [index, steps.length, finish, activeTour])

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  // Held in a ref so the effect below does not depend on it. `next` changes
  // identity on every render (it closes over `index`), and depending on it would
  // restart the anchor search — resetting the timeout and re-firing
  // scrollIntoView — on every unrelated re-render.
  const nextRef = useRef(next)
  useEffect(() => {
    nextRef.current = next
  }, [next])

  // A tour whose remaining steps all filtered out — a `when:` condition flipping
  // mid-tour, e.g. Strava connecting in another tab — would otherwise leave the
  // spotlight gone but the Escape/arrow listeners still bound to nothing.
  useEffect(() => {
    if (activeTour && steps.length > 0 && index >= steps.length && !finishing.current) {
      finishing.current = true
      finish(activeTour)
    }
  }, [activeTour, steps.length, index, finish])

  // Navigate to the step's route, then wait for its anchor to be present *and
  // visible*. The timeout is what stops an anchor that never resolves from
  // parking the user behind a spotlight over nothing — a hidden-but-mounted
  // sidebar on mobile is the case that actually hits it.
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
        nextRef.current()
        return
      }
      raf = requestAnimationFrame(look)
    }
    look()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
    }
  }, [step, pathname, router])

  // Escape ends the tour; arrows step. Bound only while a tour runs so the
  // shortcuts never interfere with normal typing.
  useEffect(() => {
    if (!activeTour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop()
        return
      }
      // Arrows move the caret when someone is typing. The tour deliberately
      // lands on pages full of inputs — the Strava card, the feedback dialog —
      // so stealing them there would rewind the tour mid-sentence.
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return
      if (e.key === 'ArrowRight') next()
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
