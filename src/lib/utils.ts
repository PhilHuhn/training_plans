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

/** Monochrome shade for a Strava activity type (chart fills, LaTeX-paper aesthetic). */
export function stravaSportHex(stravaType: string): string {
  // Stable assignment of each sport to one of a few greyscale shades so stacked
  // charts remain readable without color cues.
  const shades = ['#0A0A0A', '#3A3A3A', '#666666', '#8E8E8E', '#B5B5B5']
  const order = [
    'Run', 'Ride', 'Swim', 'WeightTraining', 'Hike',
    'TrailRun', 'VirtualRun', 'VirtualRide', 'MountainBikeRide', 'EBikeRide',
    'Walk', 'Rowing', 'Yoga', 'Workout',
  ]
  const idx = order.indexOf(stravaType)
  if (idx === -1) return '#777777'
  return shades[idx % shades.length]
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
