// User types
export interface User {
  id: number
  email: string
  name: string
  preferences: UserPreferences
  strava_connected: boolean
  profile_summary?: string
  created_at: string
}

export interface UserPreferences {
  units?: string
  hr_zones?: Record<string, ZoneRange>
  pace_zones?: Record<string, ZoneRange>
  cycling_power_zones?: Record<string, ZoneRange>
  max_hr?: number
  resting_hr?: number
  threshold_pace?: number
  ftp?: number // Functional Threshold Power in watts
}

export interface ZoneRange {
  min: number
  max: number
  name?: string
}

export interface Token {
  access_token: string
  token_type: string
}

// Activity types
export interface Activity {
  id: number
  strava_id?: string
  name: string
  activity_type: string
  description?: string
  distance?: number
  duration?: number
  elevation_gain?: number
  calories?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  avg_pace?: number
  start_date: string
  start_date_local?: string
}

export interface ActivityListResponse {
  activities: Activity[]
  total: number
  page: number
  per_page: number
}

export interface ActivityStats {
  total_activities: number
  total_distance_km: number
  total_duration_hours: number
  total_elevation_m: number
  avg_heart_rate: number
  avg_pace_per_km: number
}

// Sport stats types
export interface SportStat {
  sport: string
  count: number
  distance_km: number
  duration_hours: number
  elevation_m: number
  avg_hr: number
  calories: number
}

export interface SportStatsResponse {
  sports: SportStat[]
}

export interface WeeklySportEntry {
  week: string
  sports: Record<string, { distance_km: number; duration_hours: number; count: number }>
}

export interface WeeklyBySportResponse {
  weeks: WeeklySportEntry[]
}

// Competition types
export type RaceType = '5K' | '10K' | 'HM' | 'M' | '50K' | '100K' | '50M' | '100M' | 'OTHER'
export type RacePriority = 'A' | 'B' | 'C'

export interface Competition {
  id: number
  name: string
  race_type: RaceType
  race_date: string
  distance?: number
  elevation_gain?: number
  location?: string
  goal_time?: number
  goal_pace?: number
  priority: RacePriority
  notes?: string
  created_at: string
  updated_at: string
  days_until?: number
}

export interface CompetitionCreate {
  name: string
  race_type: RaceType
  race_date: string
  distance?: number
  elevation_gain?: number
  location?: string
  goal_time?: number
  goal_pace?: number
  priority?: RacePriority
  notes?: string
}

// Training types
export type SessionSource = 'app_recommendation' | 'uploaded_plan' | 'manual'
export type SessionStatus = 'planned' | 'completed' | 'skipped' | 'modified'

export interface WorkoutDetails {
  type: string
  sport?: string // running, cycling, swimming, strength, hiking, rowing, other
  description: string
  power_target_watts?: number // For cycling with FTP
  distance_km?: number
  duration_min?: number
  intensity?: string
  hr_zone?: string
  pace_range?: string
  intervals?: IntervalSet[]
  notes?: string
  structured?: StructuredWorkout
}

export interface StructuredWorkout {
  name: string
  sport?: string
  description?: string
  steps: WorkoutStep[]
  estimated_duration_min?: number
  estimated_distance_km?: number
}

export interface WorkoutStep {
  step_type: 'warmup' | 'active' | 'recovery' | 'rest' | 'cooldown' | 'repeat'
  name?: string
  duration_type?: 'time' | 'distance' | 'lap_button' | 'open'
  duration_value?: number
  target_type?: 'open' | 'pace' | 'heart_rate' | 'heart_rate_zone' | 'cadence'
  target_value_low?: number
  target_value_high?: number
  target_zone?: number
  repeat_count?: number
  repeat_steps?: WorkoutStep[]
  notes?: string
}

export interface IntervalSet {
  reps?: number
  distance_m?: number
  target_pace?: string
  recovery?: string
}

export interface TrainingSession {
  id: number
  session_date: string
  source: SessionSource
  status: SessionStatus
  planned_workout?: WorkoutDetails
  recommendation_workout?: WorkoutDetails
  final_workout?: WorkoutDetails
  accepted_source?: string
  completed_activity_id?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface TrainingWeekResponse {
  sessions: TrainingSession[]
  week_start: string
  week_end: string
  total_distance_planned: number
  total_distance_recommended: number
}

export interface UploadedPlan {
  id: number
  filename: string
  is_active: boolean
  parsed_sessions_count: number
  upload_date: string
}

// Chat types
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  message: ChatMessage
  tool_results?: { tool: string; input: Record<string, unknown>; result: string }[]
}

// Changelog types
export interface ChangelogEntry {
  date: string
  commits: ChangelogCommit[]
}

export interface ChangelogCommit {
  hash: string
  message: string
  author: string
  date: string
}

// Zone estimate
export interface ZoneEstimate {
  success: boolean
  error?: string
  max_hr?: number
  resting_hr?: number
  threshold_pace?: number
  hr_zones?: Record<string, ZoneRange>
  pace_zones?: Record<string, ZoneRange>
  activities_analyzed?: number
}
