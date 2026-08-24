import {
  LayoutDashboard,
  Calendar,
  Zap,
  Trophy,
  MessageCircle,
  Users,
  Settings,
  FileText,
  ShieldCheck,
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

// Appended for platform admins only (see @/server/auth/admin), so the numbering
// of every other section stays the same for ordinary users.
export const adminNavItem: NavItem = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

/** The sidebar list as this user sees it. */
export function navItemsFor(isAdmin: boolean | undefined): NavItem[] {
  return isAdmin ? [...navItems, adminNavItem] : navItems
}

export function sectionFor(pathname: string): { number: number; label: string } | null {
  // Admin resolves here too, so the header shows a title on /admin. It is not
  // an access check — the API is the gate.
  const all = [...navItems, adminNavItem]
  const idx = all.findIndex((i) => i.href === pathname)
  return idx === -1 ? null : { number: idx + 1, label: all[idx].label }
}
