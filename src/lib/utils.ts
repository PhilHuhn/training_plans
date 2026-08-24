import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number | undefined | null): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatPace(secondsPerKm: number | undefined | null): string {
  if (!secondsPerKm) return '-'
  const m = Math.floor(secondsPerKm / 60)
  const s = Math.floor(secondsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

export function formatDistance(meters: number | undefined | null): string {
  if (!meters && meters !== 0) return '-'
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDistanceKm(km: number | undefined | null): string {
  if (!km && km !== 0) return '-'
  return `${km.toFixed(1)} km`
}

export function formatGoalTime(seconds: number | undefined | null): string {
  if (!seconds) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function getWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return formatDateISO(d)
}

export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return formatDateISO(d)
}

export function daysBetween(dateStrA: string, dateStrB: string): number {
  const a = new Date(dateStrA + 'T00:00:00')
  const b = new Date(dateStrB + 'T00:00:00')
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

export function isToday(dateStr: string): boolean {
  return dateStr === formatDateISO(new Date())
}

// LaTeX-document aesthetic: status/category is conveyed through italic
// small-caps text and hairline borders rather than filled color tiles.
const monoChip = 'bg-transparent text-foreground border border-foreground/40 italic smallcaps'
const monoChipAccent = 'bg-transparent text-accent border border-accent italic smallcaps'

export function workoutTypeColor(_type: string): string {
  return monoChip
}

export function priorityColor(priority: string): string {
  // Only A-races are emphasized (maroon accent), B/C remain plain.
  return priority === 'A' ? monoChipAccent : monoChip
}

export function feedbackStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    open: 'Open',
    planned: 'Planned',
    in_progress: 'In progress',
    done: 'Done',
    declined: "Won't do",
  }
  return labels[status] ?? status
}

export function feedbackStatusColor(status: string): string {
  // Only a finished item is emphasized; everything else stays the plain chip,
  // matching priorityColor's "one status earns the accent" rule.
  return status === 'done' ? monoChipAccent : monoChip
}

export function feedbackCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    bug: 'Bug',
    feature: 'Feature request',
    question: 'Question',
    other: 'Other',
  }
  return labels[category] ?? category
}

export function phaseColor(_phase: string): string {
  return monoChip
}

export function rpeColor(rpe: number): string {
  // High effort renders in maroon italic; lower effort plain.
  return rpe >= 8 ? 'text-accent italic' : 'text-foreground italic'
}

export function sportColor(_sport: string): string {
  return monoChip
}

export function stravaSportColor(_stravaType: string): string {
  return monoChip
}

/**
 * Sport labels, colours and icons now live in @/lib/sport-theme — one map for
 * charts, badges and lists. sportColor is kept because the activity list badges
 * still want the neutral chip outline rather than a filled colour.
 */

