import "server-only";

export const TRAINING_RECOMMENDATION_SYSTEM = `You are an expert endurance coach with deep knowledge of periodization,
heart rate training, power-based training, and race preparation across multiple sports including
running (5K to ultramarathons), cycling, swimming, strength training, and other endurance activities.

Your role is to analyze an athlete's recent training data (across all sports), upcoming goals,
and current fitness to generate appropriate training recommendations. You are especially skilled at
prescribing cross-training when athletes are injured or need variety, building aerobic base through
cycling and swimming, and creating well-rounded training programs.

Key principles you follow:
1. Progressive overload with adequate recovery
2. Periodization based on upcoming race priorities
3. Balance of easy training (80%) and quality work (20%) across all sports
4. Heart rate zone training for aerobic development
5. Power zone training for cycling when FTP is available
6. Appropriate taper for A-races
7. Adjusting load based on fatigue and recovery indicators
8. Strategic cross-training for injury prevention, active recovery, and aerobic supplementation
9. Strength training for injury prevention and running economy, especially in marathon prep
10. When an athlete cross-trains regularly, integrate those activities into the plan rather than ignoring them
11. Assign a training_phase to each session reflecting the current periodization block relative to upcoming A-races
12. Include terrain type and elevation targets when recommending hilly, trail, or track sessions
13. Estimate training load (TRIMP) for each session to manage weekly stress progression
14. Set target RPE (1-10) for each session to guide athlete effort
15. For quality sessions (tempo, interval, long_run), include an alternative_workout with reduced intensity/volume as a fatigue fallback

Always output valid JSON matching the requested schema. Do NOT wrap the JSON in markdown code fences (no \`\`\`json blocks). Output raw JSON only.`;

export interface TrainingPromptInput {
  athleteName: string;
  maxHr: number | string;
  restingHr: number | string;
  thresholdPace: string;
  ftp: string;
  athleteProfile: string;
  hrZones: string;
  paceZones: string;
  cyclingPowerZones: string;
  recentActivities: string;
  weeklyDistance: string;
  weeklyDuration: string;
  weeklyAvgHr: string;
  weeklyRuns: number;
  weeklyRides: number;
  weeklyOther: number;
  upcomingCompetitions: string;
  fixedPlan: string;
  weeklyTrimp: string;
  recentRpe: string;
  startDate: string;
  endDate: string;
  planningWeeks: number;
}

export function buildTrainingRecommendationPrompt(args: TrainingPromptInput): string {
  return `Based on the following athlete data, generate training recommendations
for the specified date range.

## Athlete Information
- Name: ${args.athleteName}
- Max HR: ${args.maxHr} bpm
- Resting HR: ${args.restingHr} bpm
- Threshold Pace: ${args.thresholdPace}/km
- FTP: ${args.ftp} watts

## Athlete Profile (AI-generated summary based on recent activities)
${args.athleteProfile}

## Heart Rate Zones
${args.hrZones}

## Pace Zones (Running)
${args.paceZones}

## Cycling Power Zones
${args.cyclingPowerZones}

## Recent Activities (Last 30 days, all sports)
${args.recentActivities}

## Weekly Summary (Last 7 days)
- Total Distance: ${args.weeklyDistance} km
- Total Duration: ${args.weeklyDuration} hours
- Average HR: ${args.weeklyAvgHr} bpm
- Running sessions: ${args.weeklyRuns}
- Cycling sessions: ${args.weeklyRides}
- Other sessions: ${args.weeklyOther}

## Upcoming Competitions
${args.upcomingCompetitions}

## Current Fixed Training Plan (if any)
${args.fixedPlan}

## Weekly Training Load (TRIMP, last 4 weeks)
${args.weeklyTrimp}

## Recent RPE Feedback (last 14 days)
${args.recentRpe}

## Request
Generate a complete training plan from ${args.startDate} to ${args.endDate} (approximately ${args.planningWeeks} weeks).

IMPORTANT - Match Training to Athlete Level:
- Use the athlete profile to understand their current fitness and training patterns
- If they regularly run 50+ km/week, recommend volumes appropriate for an advanced runner
- Match interval/tempo intensities to their established pace zones
- Don't be overly conservative - challenge experienced athletes appropriately
- For race preparation, use goal paces from the competitions section

Consider:
- Current training load and fatigue across ALL sports
- Days until each competition (plan taper appropriately for A-races, typically 10-14 days)
- Progressive weekly volume building (typically 10% increase per week)
- Balance of workout types (80% easy, 20% quality work)
- Recovery needs and recovery weeks every 3-4 weeks
- The fixed plan sessions (if present) - recommend complementary or alternative sessions
- Periodization phases leading to A-race goals
- Use the athlete's actual pace zones for running workout targets
- Recommend cross-training (cycling, swimming, strength) on recovery days or when building aerobic base
- For marathon prep, include 1-2 strength sessions per week for injury prevention
- If the athlete regularly does cross-training, integrate those activities into the plan
- Use power zones for cycling if FTP is available, otherwise use HR zones
- For strength sessions, describe exercises/focus areas rather than distance/pace

Use SHORT keys to save tokens. The key mapping is:
  a=analysis, wf=weekly_focus, ss=sessions, w=warnings
  Per session: d=date, t=type, s=sport, desc=description, km=distance_km,
  min=duration_min, int=intensity, hr=hr_zone, pace=pace_range,
  pw=power_target_watts, ivl=intervals, n=notes,
  ph=training_phase, tr=terrain, el=elevation_target_m,
  load=estimated_load, rpe=rpe_target, alt=alternative_workout
  Per interval: r=reps, dm=distance_m, tp=target_pace, rec=recovery

Output as JSON with this structure:
{
  "a": "Brief analysis of current training state and recommendations rationale",
  "wf": "Main training focus for this period",
  "ss": [
    {
      "d": "YYYY-MM-DD",
      "t": "easy|tempo|interval|long_run|recovery|rest|cross_training",
      "s": "running|cycling|swimming|strength|hiking|rowing",
      "desc": "Detailed workout description",
      "km": 10.0,
      "min": 60,
      "int": "low|moderate|high",
      "hr": "zone1|zone2|zone3|zone4|zone5",
      "pace": "5:00-5:30",
      "pw": null,
      "ivl": null,
      "n": "Additional coaching notes",
      "ph": "base|build|peak|taper|recovery|race",
      "tr": "flat|hilly|trail|track|mixed",
      "el": null,
      "load": 80.0,
      "rpe": 5,
      "alt": null
    }
  ],
  "w": ["Any concerns or warnings about overtraining, injury risk, etc."]
}

For running interval sessions, include the ivl array:
"ivl": [
  {"r": 6, "dm": 800, "tp": "3:30", "rec": "90s jog"}
]

For quality sessions (tempo, interval, long_run), include alt with a simpler fallback:
"alt": {"t": "easy", "s": "running", "desc": "Easy 30min run", "min": 30, "int": "low", "hr": "zone2", "rpe": 3}
For easy/recovery/rest days, omit alt (set to null).

For cycling sessions when the athlete's FTP is set, pw is REQUIRED — a single target
wattage, typically the midpoint of the session's power zone, e.g. "pw": 195.
For all non-cycling sessions set pw to null (as in the template above).
For strength sessions, set km to null and describe the workout in desc.
Set load to the estimated TRIMP (training impulse) value for each session.
Set rpe to the target perceived exertion (1-10 scale) for each session.
Set ph to the periodization phase based on competition proximity and training block.
Set tr to terrain type when relevant (especially for trail/hilly/track sessions).`;
}

export const PLAN_CONVERSION_SYSTEM = `You are an expert running coach specializing in converting training plans
between pace-based and heart rate-based formats.

You understand that:
- Pace and HR are not perfectly correlated (affected by heat, fatigue, terrain, etc.)
- Zone conversions should preserve training intent
- Easy runs should stay easy, hard efforts should maintain stimulus

Always output valid JSON matching the requested schema. Do NOT wrap the JSON in markdown code fences (no \`\`\`json blocks). Output raw JSON only.`;

export interface PlanConversionInput {
  sourceType: string;
  targetType: string;
  hrZones: string;
  paceZones: string;
  sessionDetails: string;
  workoutType: string;
}

export function buildPlanConversionPrompt(args: PlanConversionInput): string {
  return `Convert the following training session from ${args.sourceType} to ${args.targetType}.

## Athlete's Zones
Heart Rate Zones:
${args.hrZones}

Pace Zones:
${args.paceZones}

## Original Session
${args.sessionDetails}

## Conversion Notes
- Maintain the training intent and physiological stimulus
- For intervals, convert each component appropriately
- Consider that outdoor conditions may affect the relationship

Output as JSON with this structure:
{
  "converted_session": {
    "type": "${args.workoutType}",
    "description": "Converted workout description",
    "distance_km": 10.0,
    "duration_min": 60,
    "intensity": "low|moderate|high",
    "hr_zone": "zone1|zone2|zone3|zone4|zone5",
    "pace_range": "5:00-5:30",
    "intervals": null,
    "notes": "Conversion notes and guidance"
  },
  "conversion_rationale": "Explanation of conversion choices"
}`;
}

export const DOCUMENT_PARSING_SYSTEM = `You are an expert at parsing training plans from various document formats.
You extract structured training session data from free-form text descriptions.

Common formats you handle:
- Weekly training schedules in markdown tables
- Daily workout descriptions
- Interval session notation (e.g., "8x400m @ 3:22/km")
- European and American date formats
- Metric and imperial units

IMPORTANT: You must extract EVERY training session from the document, even if the plan spans many weeks.
Markdown tables often contain multiple sessions per week - extract each row as a separate session.

Always output valid JSON matching the requested schema. Do NOT wrap the JSON in markdown code fences (no \`\`\`json blocks). Output raw JSON only.`;

export function buildDocumentParsingPrompt(documentText: string, startDate: string): string {
  return `Parse the following training plan document text and extract ALL individual training sessions.

## Document Text
${documentText}

## Instructions

EVERY session MUST have ALL of these fields populated (use null only when a
value genuinely cannot be inferred even loosely):
  - type (required, never null)
  - sport (required, never null; default "running")
  - description (required, never null)
  - distance_km (number; null only for rest/strength/swim-only sessions)
  - duration_min (number; required for all non-rest sessions — estimate from
    distance ÷ pace if not stated, e.g. 10 km at 5:00/km → 50 min)
  - intensity (low/moderate/high; required; infer from type: easy→low,
    long_run→low, recovery→low, tempo→moderate, interval/race→high)
  - hr_zone (zone1..zone5; required when intensity is set — map low→zone2,
    moderate→zone3, high→zone4)
  - pace_range (string when pace is mentioned, e.g. "4:30-4:45"; null
    otherwise)
  - intervals (array for interval sessions; null otherwise)
  - notes (free text; null only when nothing extra to add)

If duration is missing but distance and pace are both present, COMPUTE duration
as distance × pace-midpoint-seconds ÷ 60, rounded to nearest minute.

If pace is missing but description hints at effort (easy/tempo/threshold), pick
a reasonable pace_range matching the intensity (e.g. easy → "5:00-5:30").

1. Extract EVERY training session from the document - do not skip any
2. For markdown tables, each row with a workout is a separate session
3. Look for dates in format "Dec 15", "Jan 1", etc. and convert to YYYY-MM-DD format
4. Parse interval sessions like "8x400m @ 3:22/km" into the structured intervals array
5. Infer workout type from descriptions:
   - "Easy", "Recovery" → easy or recovery
   - "Intervals", "WU + Nx...m" → interval
   - "Tempo", "threshold" → tempo
   - "Long", "trail run" → long_run
   - "Cross", "Bouldering", "strength" → cross_training
   - "Rest", "complete rest" → rest
   - "HHLL", "pair run", "track session" → tempo or interval depending on description
   - "Drills", "coordination" → recovery or easy
6. Infer sport type from descriptions:
   - "ride", "bike", "cycling", "spin" → cycling
   - "swim", "pool", "laps" → swimming
   - "strength", "gym", "weights", "core" → strength
   - "hike", "walk" → hiking
   - Default to running for run/jog descriptions
7. Extract pace information like "@ 3:22/km" or "5:00-5:30/km"
8. If the document has multiple weeks, extract ALL weeks

Start date for the plan: ${startDate}
Use this to calculate actual dates from day-of-week references.

CRITICAL: Parse ALL sessions from ALL weeks in the document. A multi-week plan should return dozens of sessions.

Output as JSON:
{
  "plan_summary": "Brief description of the overall plan",
  "duration_weeks": <number of weeks>,
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "day_of_week": "Monday",
      "type": "easy|tempo|interval|long_run|recovery|rest|cross_training",
      "sport": "running|cycling|swimming|strength|hiking|rowing",
      "description": "Original workout description from the document",
      "distance_km": 10.0,
      "duration_min": 60,
      "intensity": "low|moderate|high",
      "hr_zone": "zone2",
      "pace_range": "5:30-6:00",
      "intervals": [
        {"reps": 8, "distance_m": 400, "target_pace": "3:22", "recovery": "90s jog"}
      ],
      "notes": "Any additional notes"
    }
  ],
  "parsing_notes": ["Any ambiguities or assumptions made during parsing"]
}`;
}
