import {
  LayoutDashboard,
  Calendar,
  Zap,
  Trophy,
  MessageCircle,
  Users,
  Settings,
  FileText,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  icon: LucideIcon
  label: string
}

// Order matters twice over: it numbers the sidebar's table of contents and it
// supplies the "Section N" eyebrow in the header, so both stay in step.
export const navItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/training', icon: Calendar, label: 'Training' },
  { href: '/activities', icon: Zap, label: 'Activities' },
  { href: '/competitions', icon: Trophy, label: 'Competitions' },
  { href: '/coach', icon: MessageCircle, label: 'Coach' },
  { href: '/club', icon: Users, label: 'Club' },
  { href: '/settings', icon: Settings, label: 'Settings' },
  { href: '/changelog', icon: FileText, label: 'Changelog' },
]

export function sectionFor(pathname: string): { number: number; label: string } | null {
  const idx = navItems.findIndex((i) => i.href === pathname)
  return idx === -1 ? null : { number: idx + 1, label: navItems[idx].label }
}
