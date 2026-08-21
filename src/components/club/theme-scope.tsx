'use client'
import type { CSSProperties, ReactNode } from 'react'
import type { ClubThemeWire } from '@/lib/types'

/**
 * Injects a paid club's CI colors as CSS-variable overrides on a scoped
 * container. Because globals.css maps Tailwind's `--color-*` tokens to the
 * runtime `--primary` / `--accent` / `--background` vars, overriding those on
 * this wrapper re-themes everything inside via the cascade — no global CSS
 * mutation, no flash elsewhere.
 *
 * `theme` is null on the free tier (server-enforced gate), so solo/free users
 * render with the default LaTeX palette untouched. Values are already
 * sanitized server-side (hex allowlist) before they reach the client.
 */
export default function ThemeScope({
  theme,
  children,
}: {
  theme: ClubThemeWire | null | undefined
  children: ReactNode
}) {
  if (!theme) return <>{children}</>

  const style: CSSProperties & Record<string, string> = {}
  if (theme.primary) {
    style['--primary'] = theme.primary
    style['--ring'] = theme.primary
  }
  if (theme.accent) style['--accent'] = theme.accent
  if (theme.background) style['--background'] = theme.background

  return <div style={style}>{children}</div>
}
