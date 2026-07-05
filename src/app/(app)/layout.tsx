import type { ReactNode } from 'react'
import AppLayout from '@/components/layout/app-layout'

export const dynamic = 'force-dynamic'

export default function GroupLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
