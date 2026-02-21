import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'
import Sidebar from './sidebar'
import Header from './header'
import ChatPanel from './chat-panel'
import { Sheet, SheetContent } from '@/components/ui/sheet'

const pageTitles: Record<string, string> = {
  '/training': 'Training',
  '/activities': 'Activities',
  '/competitions': 'Competitions',
  '/settings': 'Settings',
  '/changelog': 'Changelog',
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Training'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-shrink-0 border-r border-sidebar-border lg:block">
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0 [&>button]:hidden">
          <Sidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>

      {/* Chat panel */}
      <ChatPanel />
    </div>
  )
}
