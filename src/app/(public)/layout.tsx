import type { ReactNode } from 'react'
import PublicShell from '@/components/layout/public-shell'

// Not numbered: the calendar's h2s are month names, not sections of a document.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <PublicShell width="wide">{children}</PublicShell>
}
