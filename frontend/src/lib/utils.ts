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

export function workoutTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-[#6EE7B7] text-[#092B37] border-2 border-[#092B37]',
    recovery: 'bg-[#93C5FD] text-[#092B37] border-2 border-[#092B37]',
    tempo: 'bg-[#FDBA74] text-[#092B37] border-2 border-[#092B37]',
    interval: 'bg-[#FCA5A5] text-[#092B37] border-2 border-[#092B37]',
    long_run: 'bg-[#C4B5FD] text-[#092B37] border-2 border-[#092B37]',
    rest: 'bg-[#F5F0EB] text-[#092B37] border-2 border-[#092B37]',
    cross_training: 'bg-[#67E8F9] text-[#092B37] border-2 border-[#092B37]',
  }
  return colors[type] || 'bg-[#F5F0EB] text-[#092B37] border-2 border-[#092B37]'
}

export function priorityColor(priority: string): string {
  const colors: Record<string, string> = {
    A: 'bg-[#FCA5A5] text-[#092B37] border-2 border-[#092B37]',
    B: 'bg-[#FBBF24] text-[#092B37] border-2 border-[#092B37]',
    C: 'bg-[#6EE7B7] text-[#092B37] border-2 border-[#092B37]',
  }
  return colors[priority] || 'bg-[#F5F0EB] text-[#092B37] border-2 border-[#092B37]'
}

export function sportColor(sport: string): string {
  const colors: Record<string, string> = {
    running: 'bg-[#6EE7B7] text-[#092B37]',
    cycling: 'bg-[#FCD34D] text-[#092B37]',
    swimming: 'bg-[#93C5FD] text-[#092B37]',
    strength: 'bg-[#FCA5A5] text-[#092B37]',
    hiking: 'bg-[#FDBA74] text-[#092B37]',
    rowing: 'bg-[#C4B5FD] text-[#092B37]',
  }
  return colors[sport] || 'bg-[#F5F0EB] text-[#092B37]'
}

export function stravaSportColor(stravaType: string): string {
  const colors: Record<string, string> = {
    Run: 'bg-[#6EE7B7] text-[#092B37]',
    TrailRun: 'bg-[#FDBA74] text-[#092B37]',
    VirtualRun: 'bg-[#6EE7B7] text-[#092B37]',
    Ride: 'bg-[#FCD34D] text-[#092B37]',
    VirtualRide: 'bg-[#FCD34D] text-[#092B37]',
    MountainBikeRide: 'bg-[#FCD34D] text-[#092B37]',
    EBikeRide: 'bg-[#FCD34D] text-[#092B37]',
    Swim: 'bg-[#93C5FD] text-[#092B37]',
    WeightTraining: 'bg-[#FCA5A5] text-[#092B37]',
    Hike: 'bg-[#6EE7B7] text-[#092B37]',
    Walk: 'bg-[#67E8F9] text-[#092B37]',
    Rowing: 'bg-[#C4B5FD] text-[#092B37]',
  }
  return colors[stravaType] || 'bg-[#F5F0EB] text-[#092B37]'
}

export function sportLabel(sport: string): string {
  const labels: Record<string, string> = {
    running: 'Running',
    cycling: 'Cycling',
    swimming: 'Swimming',
    strength: 'Strength',
    hiking: 'Hiking',
    rowing: 'Rowing',
    other: 'Other',
  }
  return labels[sport] || sport.charAt(0).toUpperCase() + sport.slice(1)
}

export function stravaSportLabel(stravaType: string): string {
  const labels: Record<string, string> = {
    Run: 'Run',
    TrailRun: 'Trail Run',
    VirtualRun: 'Virtual Run',
    Ride: 'Ride',
    VirtualRide: 'Virtual Ride',
    MountainBikeRide: 'MTB',
    EBikeRide: 'E-Bike',
    Swim: 'Swim',
    WeightTraining: 'Strength',
    Hike: 'Hike',
    Walk: 'Walk',
    Rowing: 'Rowing',
    Yoga: 'Yoga',
    Workout: 'Workout',
  }
  return labels[stravaType] || stravaType
}

/** Color hex for a Strava activity type (for charts) */
export function stravaSportHex(stravaType: string): string {
  const colors: Record<string, string> = {
    Run: '#0D9488',
    TrailRun: '#D97706',
    VirtualRun: '#0D9488',
    Ride: '#FBBF24',
    VirtualRide: '#FBBF24',
    MountainBikeRide: '#CA8A04',
    EBikeRide: '#FBBF24',
    Swim: '#3B82F6',
    WeightTraining: '#EF4444',
    Hike: '#10B981',
    Walk: '#14B8A6',
    Rowing: '#6366F1',
    Yoga: '#A855F7',
    Workout: '#5C6B73',
  }
  return colors[stravaType] || '#5C6B73'
}

/** Strava sport icon name for badge display */
export function stravaSportIcon(stravaType: string): string {
  const map: Record<string, string> = {
    Run: 'running',
    TrailRun: 'running',
    VirtualRun: 'running',
    Ride: 'cycling',
    VirtualRide: 'cycling',
    MountainBikeRide: 'cycling',
    EBikeRide: 'cycling',
    Swim: 'swimming',
    WeightTraining: 'strength',
    Hike: 'hiking',
    Walk: 'hiking',
    Rowing: 'rowing',
  }
  return map[stravaType] || 'other'
}
