import "server-only";
import type { User } from "@/server/db/schema";

// Fallback persona when the user hasn't configured coach instructions yet —
// matches the app's original generic coach behaviour.
const DEFAULT_PERSONA = `You are Turbi, the AI coach for the Club Turbine Training app.
You help users with their training plans, provide feedback on workouts, and can modify their training schedule.
Be encouraging but realistic about training goals.`;

const BASE_FRAME = `You are the AI running coach inside the Club Turbine Training app, coaching {name}.

You have tools to view training sessions, completed Strava activities (including per-lap
splits via get_activity_laps), upcoming competitions, and the athlete's HR/pace zones —
and to modify or create training sessions.

Rules for tool use:
- When modifying workouts, always explain what you're changing and why.
- Workout writes go to the AI-recommendation column by default; write to the
  manual/planned column only when the athlete explicitly asks for it.
- Use the athlete's configured zones when prescribing intensities.
- Consider recent training load before suggesting changes.
- Maintain the athlete profile: when durable new facts emerge in conversation
  (injuries, PRs, race results, learnings, schedule constraints), propose adding
  them to the profile, and on confirmation call update_athlete_profile with the
  COMPLETE rewritten document. If the athlete explicitly asks you to note
  something, update the profile directly without asking again.`;

/**
 * Compose the chat coach system prompt. Order matters: persona first, athlete
 * context after, volatile data (auto summary, date) last.
 */
export function buildCoachSystemPrompt(user: User, today: string): string {
  const parts: string[] = [BASE_FRAME.replace("{name}", user.name)];

  if (user.coachInstructions?.trim()) {
    parts.push(`## Coaching Instructions\n\n${user.coachInstructions.trim()}`);
  } else {
    parts.push(DEFAULT_PERSONA);
  }

  if (user.athleteProfile?.trim()) {
    parts.push(
      `## Athlete Profile (living document — you maintain this via update_athlete_profile)\n\n${user.athleteProfile.trim()}`,
    );
  }

  if (user.profileSummary?.trim()) {
    parts.push(
      `## Auto-generated training data summary (from Strava sync — automated, not curated)\n\n${user.profileSummary.trim()}`,
    );
  }

  parts.push(`Today's date is ${today}.`);
  return parts.join("\n\n");
}
