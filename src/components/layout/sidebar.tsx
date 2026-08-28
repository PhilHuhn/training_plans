'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentUser, useLogout } from '@/hooks/use-auth'
import { useCompetitions } from '@/hooks/use-competitions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import SupportLink from '@/components/support-link'
import { navItemsFor } from './nav-items'
import { buildLabel } from '@/lib/version'


// The countdown bar fills as the race approaches. Twelve weeks is the usual
// build length, so anything further out simply reads as an empty bar.
const COUNTDOWN_WINDOW_DAYS = 84

interface SidebarProps {
  onClose?: () => void
}

export default function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname() ?? '/'
  const { data: user } = useCurrentUser()
  const { data: competitions } = useCompetitions()
  const logout = useLogout()

  const items = navItemsFor(user?.is_admin)
  // Constant per build, so it is read once rather than held in state.
  const build = buildLabel()

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  const nextRace = (competitions ?? [])
    .filter((c) => new Date(c.race_date) >= new Date(new Date().toDateString()))
    .sort((a, b) => a.race_date.localeCompare(b.race_date))[0]

  const daysToRace = nextRace
    ? Math.max(
        0,
        Math.round(
          (new Date(nextRace.race_date).getTime() - new Date(new Date().toDateString()).getTime()) /
            86_400_000,
        ),
      )
    : null

  const countdownPct =
    daysToRace === null ? 0 : Math.min(100, Math.max(0, ((COUNTDOWN_WINDOW_DAYS - daysToRace) / COUNTDOWN_WINDOW_DAYS) * 100))

  return (
    <div className="surface-sidebar flex h-full flex-col text-sidebar-foreground font-serif">
      {/* Title block (mimics LaTeX \title) */}
      <div className="px-5 pt-6 pb-4">
        <div className="smallcaps flex items-center gap-2 text-xs italic text-muted-foreground">
          <span className="inline-block h-px w-5 bg-current" />
          Manual
        </div>
        <div className="tt-title mt-2 text-[23px] leading-[1.1]">
          Club
          <br />
          Turbine
        </div>
        <div className="mt-1.5 text-[12.5px] italic text-muted-foreground">
          A training plan companion
        </div>
      </div>

      <div className="mx-5 h-px bg-sidebar-border" />

      {/* Table of Contents */}
      <nav className="pt-4">
        <div className="smallcaps px-5 pb-2.5 text-[11.5px] italic text-muted-foreground">
          Contents
        </div>
        <ol className="flex flex-col gap-px">
          {items.map((item, idx) => {
            const isActive = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  data-tour={`nav-${item.href.slice(1)}`}
                  className={cn(
                    'grid grid-cols-[20px_1fr_15px] items-center gap-2.5 px-5 py-2 transition-colors',
                    isActive
                      ? 'nav-active border-l-2 border-accent pl-[18px] italic'
                      : 'text-foreground/80 hover:text-foreground',
                  )}
                >
                  <span className="tabular-nums text-right text-xs text-muted-foreground">
                    {idx + 1}
                  </span>
                  <span className="text-[15px]">{item.label}</span>
                  <item.icon
                    className={cn('h-[13px] w-[13px]', isActive ? 'text-accent' : 'opacity-40')}
                  />
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>

      {/* Next race — the one number that reframes the whole week */}
      {nextRace && daysToRace !== null && (
        <Link
          href="/competitions"
          onClick={onClose}
          className="wash-primary mx-5 mt-5 border border-sidebar-border p-3.5 no-underline hover:border-primary/40"
        >
          <div className="smallcaps text-[11.5px] italic text-muted-foreground">Next race</div>
          <div className="mt-1 truncate text-[15px]">{nextRace.name}</div>
          <div className="tt-display tabular-nums text-[22px]">
            {daysToRace === 0 ? 'today' : `${daysToRace} ${daysToRace === 1 ? 'day' : 'days'}`}
          </div>
          <div className="mt-2.5 h-[3px] bg-foreground/12">
            <div className="h-[3px] bg-primary" style={{ width: `${countdownPct}%` }} />
          </div>
        </Link>
      )}

      {/* Author / colophon */}
      <div className="mt-auto border-t border-sidebar-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar className="size-8 border border-foreground/30">
            <AvatarFallback className="bg-transparent text-xs text-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{user?.name}</p>
            <p className="truncate text-[11.5px] italic text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={logout}
            aria-label="Log out"
            className="text-muted-foreground hover:text-accent"
          >
            <LogOut className="h-[15px] w-[15px]" />
          </Button>
        </div>

        {/* Build identity, and the donation link. The build doubles as the way
            back to the changelog, which is deliberately absent from the
            contents — see unlistedItems. The Ko-fi link sits here rather than
            floating over the page: the bottom-right corner already belongs to
            the coach panel's toggle. */}
        <div className="mt-2.5 flex items-baseline justify-between gap-3 text-[10.5px] text-muted-foreground/70">
          {build ? (
            <Link
              href="/changelog"
              onClick={onClose}
              title="What changed"
              className="truncate font-mono tracking-tight text-inherit no-underline transition-colors hover:text-foreground"
            >
              {build}
            </Link>
          ) : (
            <span />
          )}
          <SupportLink
            onClick={onClose}
            className="shrink-0 whitespace-nowrap text-inherit no-underline hover:text-foreground hover:no-underline"
          >
            Ko-fi
          </SupportLink>
        </div>
      </div>
    </div>
  )
}
