'use client'
import { useEffect, useState } from 'react'
import type { SectionImage as SectionImageData } from '@/lib/section-imagery'

/**
 * The photograph behind a section header.
 *
 * Two things make this safe to ship before any photo exists:
 *
 * 1. `sectionImageFor` returns null for a route with no entry, so the caller
 *    renders nothing at all.
 * 2. A registered file that is *missing* 404s, and the browser would otherwise
 *    show a broken-image glyph. `onError` removes the layer instead, so the
 *    header falls back to exactly its previous appearance. This is the normal
 *    state until files are dropped into `public/sections/`.
 *
 * Rendered with a plain <img> rather than next/image on purpose: this is a
 * decorative layer at low opacity, and next/image's fill mode would need a
 * `sizes` hint and layout constraints on a sticky bar for no visible gain.
 */
export default function SectionImage({ image }: { image: SectionImageData }) {
  const [failed, setFailed] = useState(false)

  // A new section means a new file, which deserves its own chance to load.
  useEffect(() => setFailed(false), [image.src])

  if (failed) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={image.src}
        alt=""
        onError={() => setFailed(true)}
        style={{
          objectPosition: image.position ?? 'center',
          // Per-image, because a dark photo needs dialling back where a pale
          // one disappears. The default was tuned against a light landscape on
          // the app's cream paper: below about 0.3 the strip reads as blank.
          opacity: image.opacity ?? 0.32,
        }}
        className="h-full w-full object-cover"
      />
      {/* Clears the photo out from under the title, which sits left, then lets
          it through across the rest of the strip. The stop positions matter:
          fading too far right leaves nothing visible between the heading and
          the buttons, which was the first version's mistake. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, var(--background) 0%, var(--background) 14%, color-mix(in srgb, var(--background) 40%, transparent) 30%, transparent 55%)',
        }}
      />
    </div>
  )
}
