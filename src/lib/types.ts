// User types
export interface User {
  id: number
  email: string
  name: string
  preferences: UserPreferences
  strava_connected: boolean
  is_admin: boolean
  /** False when the operator switched AI off or no API key is configured. */
  ai_enabled: boolean
  /** What to show where an AI feature would have been. Null when enabled. */
  ai_disabled_notice: string | null
  profile_summary?: string | null
  coach_instructions?: string | null
  athlete_profile?: string | null
  created_at: string
}

export interface UserPreferences {
  units?: string
  hr_zones?: Record<string, ZoneRange>
  pace_zones?: Record<string, ZoneRange>
  cycling_power_zones?: Record<string, ZoneRange>
  max_hr?: number
  resting_hr?: number
  threshold_hr?: number
  threshold_pace?: number
  threshold_hr_source?: 'sustained_efforts' | 'max_fraction' | 'manual'
  threshold_pace_source?: 'sustained_runs' | 'riegel' | 'percentile' | 'manual'
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

// Dashboard stats types
export interface DashboardPeriodSummary {
  count: number
  distance_km: number
  duration_hours: number
  elevation_m: number
  avg_heart_rate: number | null
  avg_run_pace: number | null
}

export interface DashboardLoadPoint {
  date: string
  trimp: number
  ctl: number
  atl: number
  tsb: number
}

export interface DashboardZoneEntry {
  zone: string
  name: string
  min: number
  max: number
  hours: number
}

export interface DashboardPacePoint {
  date: string
  pace: number
  distance_km: number
  avg_hr: number | null
  name: string
}

export interface DashboardRecordActivity {
  id: number
  name: string
  date: string
  distance_km: number | null
  elevation_m: number | null
  pace: number | null
}

export interface DashboardStats {
  days: number
  summary: DashboardPeriodSummary
  previous: DashboardPeriodSummary
  load: DashboardLoadPoint[]
  zone_distribution: DashboardZoneEntry[]
  pace_trend: DashboardPacePoint[]
  records: {
    longest: DashboardRecordActivity | null
    most_elevation: DashboardRecordActivity | null
    fastest_run_5k_plus: DashboardRecordActivity | null
    biggest_week: { week: string; distance_km: number } | null
  }
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
  training_phase?: 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'race'
  terrain?: 'flat' | 'hilly' | 'trail' | 'track' | 'mixed'
  elevation_target_m?: number
  estimated_load?: number
  rpe_target?: number // 1-10
  alternative_workout?: WorkoutDetails
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
  duration_sec?: number
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
  rpe_actual?: number // 1-10 post-workout RPE
  flex_days?: number // ± days this session may shift for club overlay matching
  actual_load?: number // Calculated TRIMP
  completed_activity_summary?: {
    distance_km: number
    duration_min: number
    avg_hr?: number
    avg_pace?: number
  }
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
  training_phase?: string
  total_load_planned?: number
  total_load_actual?: number
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

// Zone history
export interface ZoneHistoryEntry {
  id: number
  calculated_at: string | null
  source: string // 'manual' | 'strava_estimate' | 'reverted'
  activities_analyzed?: number
  max_hr?: number
  resting_hr?: number
  threshold_pace?: number
  hr_zones?: Record<string, ZoneRange>
  pace_zones?: Record<string, ZoneRange>
  ftp?: number
  cycling_power_zones?: Record<string, ZoneRange>
}

// Zone estimate
export interface ZoneEstimate {
  success: boolean
  error?: string
  max_hr?: number
  resting_hr?: number
  threshold_hr?: number
  threshold_hr_source?: 'sustained_efforts' | 'max_fraction'
  threshold_pace?: number
  threshold_pace_source?: 'sustained_runs' | 'riegel' | 'percentile'
  hr_zones?: Record<string, ZoneRange>
  pace_zones?: Record<string, ZoneRange>
  activities_analyzed?: number
}

// Club overlay types
export type ClubRole = 'coach' | 'athlete' | 'captain'
export type ClubVisibility = 'typ_only' | 'full'
export type ClubPlanTier = 'free' | 'paid'
export type CompromiseMode =
  | 'SHARED_PACE'
  | 'SHARED_EASY_SEGMENT'
  | 'SHARED'
  | 'PARALLEL_TIME_BASED'
  | 'PARALLEL_SAME_STRUCTURE'
  | 'COLOCATED_OPTIONAL'

export interface ClubThemeWire {
  primary?: string
  accent?: string
  background?: string
  logo_url?: string
}

export interface SponsorWire {
  name: string
  logo_url?: string | null
  url?: string | null
  discount_code?: string | null
}

export interface ClubSummary {
  id: number
  name: string
  slug: string
  plan_tier: ClubPlanTier
  role: ClubRole
  visibility: ClubVisibility
}

/** POST /api/club response — a summary plus the freshly minted join code. */
export interface ClubCreatedResponse extends ClubSummary {
  join_code: string
}

export interface AdminMembershipWire {
  club_id: number
  club_name: string
  slug: string
  role: ClubRole
  visibility: ClubVisibility
}

export interface AdminUserWire {
  id: number
  email: string
  name: string
  created_at: string
  strava_connected: boolean
  is_admin: boolean
  /** True when admin comes from ADMIN_EMAILS, which the dashboard cannot revoke. */
  admin_via_env: boolean
  memberships: AdminMembershipWire[]
}

export interface AiSettingsWire {
  enabled: boolean
  notice: string
  api_key_configured: boolean
  /** enabled AND a key is present — what users actually experience. */
  effective: boolean
}

// Feedback types
export type FeedbackCategory = 'bug' | 'feature' | 'question' | 'other'
export type FeedbackStatus = 'open' | 'planned' | 'in_progress' | 'done' | 'declined'

export interface FeedbackItem {
  id: number
  category: FeedbackCategory
  title: string
  body: string
  status: FeedbackStatus
  /** The operator's reply, shown to the submitter. */
  admin_note: string | null
  page_url: string | null
  created_at: string
  updated_at: string
}

export interface FeedbackCreate {
  category: FeedbackCategory
  title: string
  body: string
  page_url?: string | null
}

/** A submission as the admin dashboard sees it — adds who sent it. */
export interface AdminFeedbackWire extends FeedbackItem {
  user_id: number
  user_name: string
  user_email: string
}

export interface AdminClubWire {
  id: number
  name: string
  slug: string
  plan_tier: ClubPlanTier
  donation_url: string | null
  join_code: string
  member_count: number
  created_at: string
}

export interface ClubMemberWire {
  user_id: number
  name: string
  role: ClubRole
  visibility: ClubVisibility
}

export interface ClubDetailResponse {
  id: number
  name: string
  slug: string
  plan_tier: ClubPlanTier
  donation_url?: string | null
  // Coaches only — the code teammates use to join. Null for everyone else.
  join_code?: string | null
  members: ClubMemberWire[]
  // Paid features — null on the free tier (server-enforced gate).
  theme: ClubThemeWire | null
  sponsor: SponsorWire | null
  powered_by: boolean
}

// One member session as seen by the viewer. When `redacted` is true, only
// availability + session type + duration survive (visibility=typ_only).
export interface ClubMemberSessionWire {
  session_id: number
  user_id: number
  session_date: string
  status: SessionStatus
  session_type: string | null
  duration_min?: number | null
  redacted: boolean
  distance_km?: number | null
  pace_range?: string | null
  hr_zone?: string | null
  intensity?: string | null
  description?: string | null
  intervals?: IntervalSet[] | null
}

export interface CompromiseWire {
  date: string
  weekday: number
  mode: CompromiseMode
  compat_class: string
  member_ids: number[]
  member_session_ids: number[]
  note: string
  shared_pace_sec?: number | null
  skeleton?: string | null
  shifted?: { session_id: number; from: string; to: string }[]
}

export interface ClubOverlayRow {
  user_id: number
  name: string
  role: ClubRole
  visibility: ClubVisibility
  sessions: ClubMemberSessionWire[]
}

export interface ClubOverlayResponse {
  club: ClubSummary
  week_start: string
  week_end: string
  rows: ClubOverlayRow[]
  shared: CompromiseWire[]
}
