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

export function isToday(dateStr: string): boolean {
  return dateStr === formatDateISO(new Date())
}

export function workoutTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-green-100 text-green-700',
    recovery: 'bg-blue-100 text-blue-700',
    tempo: 'bg-orange-100 text-orange-700',
    interval: 'bg-red-100 text-red-700',
    long_run: 'bg-purple-100 text-purple-700',
    rest: 'bg-zinc-100 text-zinc-500',
    cross_training: 'bg-cyan-100 text-cyan-700',
  }
  return colors[type] || 'bg-zinc-100 text-zinc-700'
}

export function priorityColor(priority: string): string {
  const colors: Record<string, string> = {
    A: 'bg-red-100 text-red-700 border-red-200',
    B: 'bg-amber-100 text-amber-700 border-amber-200',
    C: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  return colors[priority] || 'bg-zinc-100 text-zinc-700'
}
