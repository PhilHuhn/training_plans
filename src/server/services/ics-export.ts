// Hand-rolled .ics export (own sessions only in v1). Sessions are date-only,
// so we emit all-day VEVENTs (DTSTART;VALUE=DATE) — this sidesteps timezone/
// VTIMEZONE handling entirely. Pure module (no "server-only") so the
// round-trip tests can import it.

import type { WorkoutDetails } from "@/lib/types";
import { formatPace } from "@/lib/pace-utils";

const TYPE_LABEL: Record<string, string> = {
  easy: "Easy",
  recovery: "Recovery",
  long_run: "Long Run",
  tempo: "Tempo",
  interval: "Intervals",
  threshold: "Threshold",
  rest: "Rest",
  cross_training: "Cross",
  race: "Race",
};

export type IcsSession = {
  id: number;
  /** YYYY-MM-DD */
  sessionDate: string;
  workout: WorkoutDetails | null;
};

/** RFC 5545 text escaping: backslash, semicolon, comma, newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Fold content lines at 75 octets (UTF-8) with CRLF + space continuation. */
function foldLine(line: string): string[] {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  const limit = () => (out.length === 0 ? 75 : 74); // continuation lines start with a space
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > limit()) {
      out.push(current);
      current = "";
      currentBytes = 0;
    }
    current += ch;
    currentBytes += chBytes;
  }
  if (current) out.push(current);
  return out.map((l, i) => (i === 0 ? l : ` ${l}`));
}

function compactDate(iso: string): string {
  return iso.replaceAll("-", "");
}

function nextDay(iso: string): string {
  return new Date(Date.parse(iso) + 24 * 3600 * 1000).toISOString().slice(0, 10);
}

export function summaryFor(workout: WorkoutDetails | null): string {
  if (!workout) return "Training";
  const label = TYPE_LABEL[workout.type] ?? workout.type ?? "Training";
  const metric: string[] = [];
  if (workout.distance_km) metric.push(`${workout.distance_km} km`);
  else if (workout.duration_min) metric.push(`${workout.duration_min} min`);
  return metric.length ? `${label} ${metric.join(" ")}` : label;
}

function descriptionFor(workout: WorkoutDetails | null): string | null {
  if (!workout) return null;
  const parts: string[] = [];
  if (workout.description) parts.push(workout.description);
  if (workout.pace_range) parts.push(`Pace: ${workout.pace_range}`);
  else if (workout.hr_zone) parts.push(`HR: ${workout.hr_zone}`);
  for (const set of workout.intervals ?? []) {
    const dist = set.distance_m ? `${set.distance_m}m` : set.duration_sec ? `${set.duration_sec}s` : "?";
    const pace = set.target_pace ? ` @ ${set.target_pace}` : "";
    const rec = set.recovery ? `, Pause ${set.recovery}` : "";
    parts.push(`${set.reps ?? 1}×${dist}${pace}${rec}`);
  }
  if (workout.duration_min && workout.distance_km) parts.push(`${workout.duration_min} min`);
  return parts.length ? parts.join("\n") : null;
}

export function buildIcsForSessions(sessions: IcsSession[], calendarName = "Training"): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turbine Turmweg//Training Plan//DE",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const session of sessions) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:session-${session.id}@turbine-turmweg`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${compactDate(session.sessionDate)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay(session.sessionDate))}`);
    lines.push(`SUMMARY:${escapeText(summaryFor(session.workout))}`);
    const description = descriptionFor(session.workout);
    if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.flatMap(foldLine).join("\r\n") + "\r\n";
}
