'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Zap,
  Trophy,
  Settings,
  FileText,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/training', icon: Calendar, label: 'Training' },
  { href: '/activities', icon: Zap, label: 'Activities' },
  { href: '/competitions', icon: Trophy, label: 'Competitions' },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/changelog', icon: FileText, label: 'Changelog' },
]

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname() ?? '/'
  const { data: user } = useCurrentUser()
  const logout = useLogout()

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border font-serif">
      {/* Title block (mimics LaTeX \title) */}
      <div className="px-6 pt-6 pb-4">
        <div className="text-xs italic smallcaps text-muted-foreground">Manual</div>
        <div className="text-2xl leading-tight tracking-tight">Turbine&nbsp;Turmweg</div>
        <div className="text-xs italic text-muted-foreground mt-1">A training plan companion</div>
      </div>

      <div className="px-6">
        <div className="border-t border-sidebar-border" />
      </div>

      {/* Table of Contents */}
      <nav className="flex-1 px-6 py-4">
        <div className="text-xs italic smallcaps text-muted-foreground mb-2">Contents</div>
        <ol className="space-y-0.5">
          {navItems.map((item, idx) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'group flex items-baseline gap-2 px-1 py-1 text-sm transition-colors',
                    isActive
                      ? 'text-foreground border-l-2 border-accent pl-2 -ml-3'
                      : 'text-foreground/75 hover:text-foreground',
                  )}
                >
                  <span className="tabular-nums w-5 text-right">{idx + 1}.</span>
                  <span className={cn('flex-1', isActive && 'italic')}>{item.label}</span>
                  <item.icon className="h-3.5 w-3.5 opacity-50" />
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      <div className="px-6">
        <div className="border-t border-sidebar-border" />
      </div>

      {/* Author / colophon */}
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border border-foreground/30">
            <AvatarFallback className="bg-transparent text-xs text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm">{user?.name}</p>
            <p className="truncate text-xs italic text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-muted-foreground transition-colors hover:text-accent"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
