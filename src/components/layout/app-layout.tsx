'use client'
import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import Sidebar from './sidebar'
import Header from './header'
import ChatPanel from './chat-panel'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { sectionFor } from './nav-items'

// Dashboard and Training open with a full-bleed band that has to touch the
// scrollport edges, so they take over their own padding. Every other page keeps
// the shell's standard column.
const FULL_BLEED_ROUTES = new Set(['/dashboard', '/training'])


export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname() ?? '/training'
  const section = sectionFor(pathname)
  const fullBleed = FULL_BLEED_ROUTES.has(pathname)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-[248px] flex-shrink-0 border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[248px] p-0 [&>button]:hidden">
          <Sidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={section?.label ?? 'Training'}
          section={section?.number}
          onMenuClick={() => setMobileOpen(true)}
        />
        {/* Padding lives on an inner div, not on the scroll container itself:
            sticky headers pin at the scrollport edge, and browsers place that
            edge below the scroller's own padding — padding on <main> would
            leave a see-through gap above sticky table headers. */}
        <main className="tex-numbered min-h-0 flex-1 overflow-y-auto">
          {fullBleed ? children : <div className="px-4 py-6 lg:px-10 lg:py-10">{children}</div>}
        </main>
      </div>

      {/* Chat panel */}
      <ChatPanel />
    </div>
  )
}
