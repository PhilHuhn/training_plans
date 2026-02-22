import { Link, useLocation } from 'react-router'
import {
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
import { Separator } from '@/components/ui/separator'

const navItems = [
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
  const location = useLocation()
  const { data: user } = useCurrentUser()
  const logout = useLogout()

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-none border-2 border-sidebar-border bg-sidebar-primary">
          <Zap className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="text-lg font-bold uppercase tracking-wider">Turbine</span>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 rounded-none px-3 py-2.5 text-sm font-bold uppercase tracking-wider transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary border-l-4 border-sidebar-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <Separator className="bg-sidebar-border" />

      {/* User section */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border-2 border-sidebar-border">
            <AvatarFallback className="bg-sidebar-accent text-xs text-sidebar-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-sidebar-foreground/60">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="rounded-none p-1.5 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
