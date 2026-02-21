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

export function sportColor(sport: string): string {
  const colors: Record<string, string> = {
    running: 'bg-green-100 text-green-700',
    cycling: 'bg-yellow-100 text-yellow-700',
    swimming: 'bg-blue-100 text-blue-700',
    strength: 'bg-rose-100 text-rose-700',
    hiking: 'bg-amber-100 text-amber-700',
    rowing: 'bg-indigo-100 text-indigo-700',
  }
  return colors[sport] || 'bg-zinc-100 text-zinc-700'
}

export function stravaSportColor(stravaType: string): string {
  const colors: Record<string, string> = {
    Run: 'bg-green-100 text-green-700',
    TrailRun: 'bg-amber-100 text-amber-700',
    VirtualRun: 'bg-green-100 text-green-700',
    Ride: 'bg-yellow-100 text-yellow-700',
    VirtualRide: 'bg-yellow-100 text-yellow-700',
    MountainBikeRide: 'bg-yellow-100 text-yellow-700',
    EBikeRide: 'bg-yellow-100 text-yellow-700',
    Swim: 'bg-blue-100 text-blue-700',
    WeightTraining: 'bg-rose-100 text-rose-700',
    Hike: 'bg-emerald-100 text-emerald-700',
    Walk: 'bg-teal-100 text-teal-700',
    Rowing: 'bg-indigo-100 text-indigo-700',
  }
  return colors[stravaType] || 'bg-zinc-100 text-zinc-700'
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
    Run: '#22c55e',
    TrailRun: '#f59e0b',
    VirtualRun: '#86efac',
    Ride: '#eab308',
    VirtualRide: '#fde047',
    MountainBikeRide: '#ca8a04',
    EBikeRide: '#facc15',
    Swim: '#3b82f6',
    WeightTraining: '#f43f5e',
    Hike: '#10b981',
    Walk: '#14b8a6',
    Rowing: '#6366f1',
    Yoga: '#a855f7',
    Workout: '#6b7280',
  }
  return colors[stravaType] || '#9ca3af'
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
