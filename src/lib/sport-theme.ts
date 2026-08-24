import {
  Activity,
  Bike,
  Dumbbell,
  Flower2,
  Footprints,
  Mountain,
  MountainSnow,
  PersonStanding,
  Sailboat,
  TreePine,
  Waves,
  type LucideIcon,
} from 'lucide-react'

/**
 * One source of truth for how a sport looks: label, colour, icon.
 *
 * Colours mirror the --chart-* tokens in globals.css. They are duplicated as
 * literals here because recharts wants a concrete value for `fill`/`stroke`,
 * and because these strings are unit-tested for distinctness. Keep the two
 * lists in sync when editing either.
 */
export const SPORT_COLORS = {
  run: '#1F3A93', // hyperref blue
  ride: '#7E1F2E', // maroon
  swim: '#2A6F6B', // verdigris
  strength: '#9A6A1F', // ochre
  yoga: '#5B3A6E', // plum
  hike: '#4A5D2A', // olive
  other: '#55606B', // slate
  ink: '#0A0A0A',
} as const

export type SportFamily = keyof typeof SPORT_COLORS

export interface SportTheme {
  label: string
  /** Family the sport belongs to — related sports share a hue. */
  family: SportFamily
  color: string
  Icon: LucideIcon
}

/**
 * Every sport gets its own shade, tinted from its family's base hue. Sharing
 * one flat colour per family looked tidy in the abstract but made Hike/Walk and
 * Yoga/Climbing indistinguishable wherever they sit side by side — a stacked
 * bar or a pie slice, which is exactly what the old greyscale ramp got wrong.
 */
const SHADES: Record<string, string> = {
  Run: '#1F3A93',
  TrailRun: '#4260BC',
  VirtualRun: '#7288CE',
  Ride: '#7E1F2E',
  MountainBikeRide: '#A8434F',
  VirtualRide: '#C87B84',
  EBikeRide: '#8C5A5F',
  Swim: '#2A6F6B',
  Rowing: '#57A099',
  WeightTraining: '#9A6A1F',
  Workout: '#C4933F',
  Yoga: '#5B3A6E',
  RockClimbing: '#8D63A3',
  Hike: '#4A5D2A',
  Walk: '#7C9152',
}

// Strava's legacy activity `type` strings, which is what lands in
// activities.activity_type (see @/server/services/strava). Sports in one family
// share a colour; the icon still distinguishes them.
const SPORTS: Record<string, Omit<SportTheme, 'color'>> = {
  Run: { label: 'Run', family: 'run', Icon: Footprints },
  TrailRun: { label: 'Trail Run', family: 'run', Icon: TreePine },
  VirtualRun: { label: 'Virtual Run', family: 'run', Icon: Footprints },
  Ride: { label: 'Ride', family: 'ride', Icon: Bike },
  VirtualRide: { label: 'Virtual Ride', family: 'ride', Icon: Bike },
  MountainBikeRide: { label: 'MTB', family: 'ride', Icon: Bike },
  EBikeRide: { label: 'E-Bike', family: 'ride', Icon: Bike },
  Swim: { label: 'Swim', family: 'swim', Icon: Waves },
  Rowing: { label: 'Rowing', family: 'swim', Icon: Sailboat },
  WeightTraining: { label: 'Strength', family: 'strength', Icon: Dumbbell },
  Workout: { label: 'Workout', family: 'strength', Icon: Dumbbell },
  Yoga: { label: 'Yoga', family: 'yoga', Icon: Flower2 },
  RockClimbing: { label: 'Climbing', family: 'yoga', Icon: MountainSnow },
  Hike: { label: 'Hike', family: 'hike', Icon: Mountain },
  Walk: { label: 'Walk', family: 'hike', Icon: PersonStanding },
}

// activity_type is a free-form varchar fed straight from Strava, so an
// unrecognised sport is expected rather than exceptional. It gets the neutral
// slate and a generic icon — never the running shoe, which would misread.
const FALLBACK: Omit<SportTheme, 'color' | 'label'> = { family: 'other', Icon: Activity }

/** Look up the theme for a Strava activity type. Never throws. */
export function sportTheme(stravaType: string): SportTheme {
  const known = SPORTS[stravaType]
  if (known) return { ...known, color: SHADES[stravaType] ?? SPORT_COLORS[known.family] }
  return {
    ...FALLBACK,
    label: stravaType || 'Other',
    color: SPORT_COLORS[FALLBACK.family],
  }
}

/** The app's own lowercase planning taxonomy (training plans, not Strava). */
const PLANNING_SPORTS: Record<string, string> = {
  running: 'Run',
  cycling: 'Ride',
  swimming: 'Swim',
  strength: 'WeightTraining',
  hiking: 'Hike',
  rowing: 'Rowing',
  other: 'Other',
}

/** Theme for a planned session's sport, reusing the Strava mapping. */
export function planningSportTheme(sport: string): SportTheme {
  const theme = sportTheme(PLANNING_SPORTS[sport] ?? sport)
  // Planning labels are the friendlier ones ("Running", not "Run").
  return { ...theme, label: sport.charAt(0).toUpperCase() + sport.slice(1) }
}

/** Shared recharts tooltip chrome — a hairline box on paper, no shadow. */
export const CHART_TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 0,
  border: `1px solid ${SPORT_COLORS.ink}`,
  backgroundColor: '#FAF8F2',
  fontFamily: 'inherit',
} as const

/**
 * Sequential ramp for ordered series (HR zones, intensity buckets) where the
 * categorical palette would imply unrelated categories.
 */
export const SEQUENTIAL_RAMP = ['#C9D0E4', '#98A6CC', '#6A7CB0', '#41568F', '#1F3A93'] as const
