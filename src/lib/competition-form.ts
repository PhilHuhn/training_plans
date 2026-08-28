/**
 * Turning the competition dialog's fields into an API payload, and back.
 *
 * Pure, so the two things that were wrong here are testable: a goal time split
 * across three inputs, and the difference between "leave this field alone" and
 * "clear this field".
 */

import type { CompetitionCreate, RacePriority, RaceType } from "./types";

/** The dialog's raw state — every field a string, as the inputs hold them. */
export interface CompetitionFormState {
  name: string;
  raceType: RaceType;
  raceDate: string;
  priority: RacePriority;
  location: string;
  goalTimeH: string;
  goalTimeM: string;
  goalTimeS: string;
  notes: string;
}

/** A day. No race goal exceeds this, and it keeps the total inside int4. */
export const MAX_GOAL_SECONDS = 24 * 60 * 60;

/** Hours/minutes/seconds as separate inputs, which is how the dialog asks. */
export interface GoalTimeParts {
  h: string;
  m: string;
  s: string;
}

/**
 * The three goal-time inputs as a total in seconds, or null when all are blank.
 *
 * Null rather than undefined: a blank goal time on an edit means "remove the
 * goal I had", and only null carries that through the API.
 */
export function goalTimeToSeconds(parts: GoalTimeParts): number | null {
  const anyGiven = [parts.h, parts.m, parts.s].some((v) => v.trim() !== "");
  if (!anyGiven) return null;

  const n = (v: string) => {
    const parsed = Number.parseInt(v.trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };
  const total = n(parts.h) * 3600 + n(parts.m) * 60 + n(parts.s);
  if (total <= 0) return null;
  // The column is a Postgres `integer`. The hours box has no upper bound, so a
  // fat-fingered "999999" would otherwise reach the driver and come back as a
  // 500 rather than anything the athlete could act on. A goal time is bounded
  // by a day in any case.
  return Math.min(total, MAX_GOAL_SECONDS);
}

/** A stored goal time back into the three inputs. Blank when there is none. */
export function goalTimeToParts(seconds: number | null | undefined): GoalTimeParts {
  if (!seconds || seconds <= 0) return { h: "", m: "", s: "" };
  return {
    h: String(Math.floor(seconds / 3600)),
    m: String(Math.floor((seconds % 3600) / 60)),
    s: String(seconds % 60),
  };
}

/**
 * The payload for create or update.
 *
 * Optional text fields become **null** when blank, never undefined. The update
 * route applies a field only when it is not undefined, so the previous
 * `value || undefined` meant an emptied box silently kept its old value — you
 * could add a location but never remove one.
 */
export function competitionPayload(form: CompetitionFormState): CompetitionCreate {
  return {
    name: form.name.trim(),
    race_type: form.raceType,
    race_date: form.raceDate,
    priority: form.priority,
    location: form.location.trim() || null,
    goal_time: goalTimeToSeconds({ h: form.goalTimeH, m: form.goalTimeM, s: form.goalTimeS }),
    notes: form.notes.trim() || null,
  };
}

/** Whether the dialog has enough to save. Mirrors the server's required fields. */
export function isCompetitionFormValid(form: CompetitionFormState): boolean {
  return form.name.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(form.raceDate);
}
