import type { ReactNode } from 'react'

/**
 * Deliberately outside the (app) group: /welcome renders without the sidebar,
 * and is not a nav item. nav-items.ts warns that the order of navItems numbers
 * both the sidebar's table of contents and the header's "Section N" eyebrow, so
 * anything inserted there renumbers every section below it.
 */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
