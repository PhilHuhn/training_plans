import type { ReactNode } from 'react'
import PublicShell from '@/components/layout/public-shell'

export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell width="prose" numbered>
      {children}
    </PublicShell>
  )
}
