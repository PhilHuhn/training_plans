'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TourStep } from '@/lib/tour-steps'

/** Breathing room between the highlight and the element it surrounds. */
const PAD = 6
/** Gap between the highlight and the explanation card. */
const GAP = 12
const CARD_WIDTH = 320
/** Keep the card off the very edge of the viewport. */
const MARGIN = 12

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

function readRect(el: HTMLElement): Rect {
  const r = el.getBoundingClientRect()
  return {
    top: r.top - PAD,
    left: r.left - PAD,
    width: r.width + PAD * 2,
    height: r.height + PAD * 2,
  }
}

/**
 * Position the card beside the highlight, clamped into the viewport.
 *
 * Returns viewport coordinates — the overlay is `position: fixed`, so it does
 * not need to care about scroll offsets.
 */
function cardPosition(
  rect: Rect,
  placement: TourStep['placement'],
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const preferred = placement ?? 'bottom'
  let top: number
  let left: number

  switch (preferred) {
    case 'top':
      top = rect.top - GAP
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2
      // Measured height is unknown before paint; 180 is a safe reservation that
      // the clamp below corrects for short cards.
      top -= 180
      break
    case 'left':
      top = rect.top
      left = rect.left - CARD_WIDTH - GAP
      break
    case 'right':
      top = rect.top
      left = rect.left + rect.width + GAP
      break
    default:
      top = rect.top + rect.height + GAP
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2
  }

  left = Math.min(Math.max(MARGIN, left), viewport.width - CARD_WIDTH - MARGIN)
  top = Math.min(Math.max(MARGIN, top), viewport.height - 180 - MARGIN)
  return { top, left }
}

interface TourSpotlightProps {
  target: HTMLElement
  step: TourStep
  stepNumber: number
  stepCount: number
  onNext: () => void
  onBack: () => void
  onStop: () => void
}

export default function TourSpotlight({
  target,
  step,
  stepNumber,
  stepCount,
  onNext,
  onBack,
  onStop,
}: TourSpotlightProps) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const measure = () => {
      setRect(readRect(target))
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    measure()

    // Anything can move the anchor: a scroll, a resize, a chart finishing its
    // layout. A ResizeObserver alone would miss the first two.
    const observer = new ResizeObserver(measure)
    observer.observe(target)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [target])

  // Portalled to <body> so no ancestor's overflow or stacking context can clip
  // the overlay.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || !rect) return null

  const { top, left } = cardPosition(rect, step.placement, viewport)
  const dim = 'fixed bg-foreground/45'
  const isLast = stepNumber >= stepCount

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label={step.title}>
      {/* Four rects around the anchor rather than a box-shadow cutout: with
          --radius: 0 the edges stay crisp, and the anchor itself is left
          untouched and genuinely clickable. */}
      <div className={dim} style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top) }} />
      <div
        className={dim}
        style={{ top: rect.top + rect.height, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className={dim}
        style={{ top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height }}
      />
      <div
        className={dim}
        style={{ top: rect.top, left: rect.left + rect.width, right: 0, height: rect.height }}
      />

      {/* The highlight ring. pointer-events-none so it never eats a click meant
          for the element underneath. */}
      <div
        className="pointer-events-none fixed border border-accent"
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }}
      />

      <div
        className="fixed border border-foreground/30 bg-background p-4 font-serif shadow-[3px_3px_0_0_rgba(0,0,0,0.08)]"
        style={{ top, left, width: CARD_WIDTH }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">
            Step {stepNumber} of {stepCount}
          </div>
          <button
            onClick={onStop}
            aria-label="End the tour"
            className="text-muted-foreground transition-colors hover:text-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <h2 className="mt-1 text-[17px] leading-tight">{step.title}</h2>
        <p className="prose-paper mt-2 text-sm text-muted-foreground">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={onNext}>
            {isLast ? 'Done' : 'Next'}
          </Button>
          {stepNumber > 1 && (
            <Button size="sm" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          <button
            onClick={onStop}
            className="ml-auto text-xs italic text-muted-foreground hover:text-foreground"
          >
            Skip the tour
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
