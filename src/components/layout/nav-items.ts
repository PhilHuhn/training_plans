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

// The numbered contents. Order matters twice over: it numbers the sidebar's
// table of contents and it supplies the "Section N" eyebrow in the header, so
// both stay in step. Append; never insert into the middle.
export const navItems: NavItem[] = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/training', icon: Calendar, label: 'Training' },
  { href: '/activities', icon: Zap, label: 'Activities' },
  { href: '/competitions', icon: Trophy, label: 'Competitions' },
  { href: '/coach', icon: MessageCircle, label: 'Coach' },
  { href: '/club', icon: Users, label: 'Club' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

// Reachable and titled, but deliberately absent from the contents. A release
// log is not somewhere anyone needs to navigate to, and it was the eighth line
// of an eight-line list. Listing it here rather than deleting it is what keeps
// the page's own header working — sectionFor() is the header's only source of
// a title, so an unlisted route would otherwise render under "Training".
export const unlistedItems: NavItem[] = [
  { href: '/changelog', icon: FileText, label: 'Changelog' },
]

// Appended for platform admins only (see @/server/auth/admin), so the numbering
// of every other section stays the same for ordinary users.
export const adminNavItem: NavItem = { href: '/admin', icon: ShieldCheck, label: 'Admin' }

/** The sidebar list as this user sees it. */
export function navItemsFor(isAdmin: boolean | undefined): NavItem[] {
  return isAdmin ? [...navItems, adminNavItem] : navItems
}

/**
 * The header's title and, where there is one, its section number.
 *
 * `number` is absent for unlisted routes, which is the honest reading: they are
 * not sections of the manual, so they get a heading and no eyebrow. The header
 * already guards on `section !== undefined`, so this degrades on its own.
 */
export function sectionFor(pathname: string): { number?: number; label: string } | null {
  // Admin resolves here too, so the header shows a title on /admin. It is not
  // an access check — the API is the gate.
  const numbered = [...navItems, adminNavItem]
  const idx = numbered.findIndex((i) => i.href === pathname)
  if (idx !== -1) return { number: idx + 1, label: numbered[idx].label }

  const unlisted = unlistedItems.find((i) => i.href === pathname)
  return unlisted ? { label: unlisted.label } : null
}
