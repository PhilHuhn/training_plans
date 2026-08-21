// .ics import: parse an uploaded calendar into planned training sessions.
// node-ical handles the parsing edge cases (folding, encodings, vendor
// quirks); this module maps VEVENTs onto WorkoutDetails via summary keyword
// heuristics. v1 policy: recurring events (RRULE) are skipped with a warning.
// Pure module (no "server-only") so the fixture tests can import it.

import ical from "node-ical";
import type { WorkoutDetails } from "@/lib/types";

export type ParsedIcsSession = {
  /** YYYY-MM-DD */
  sessionDate: string;
  workout: WorkoutDetails;
};

export type IcsImportResult = {
  sessions: ParsedIcsSession[];
  /** Human-readable notes about entries that were skipped. */
  skipped: string[];
};

/** Summary keyword → workout type (existing vocabulary, German + English). */
export function inferWorkoutType(summary: string): string {
  const s = summary.toLowerCase();
  if (/wettkampf|\brace\b|marathon\b.*start/i.test(s)) return "race";
  if (/intervall|interval|\d+\s*[x×]\s*\d+/.test(s)) return "interval";
  if (/tempo|schwelle|threshold|\btdl\b/.test(s)) return "tempo";
  if (/langer lauf|long run|\blong\b|\blala\b|\blang\b/.test(s)) return "long_run";
  if (/kraft|strength|athletik|stabi|cross|yoga|rad|bike|schwimm|swim/.test(s)) return "cross_training";
  if (/ruhetag|ruhe|\brest\b|pause/.test(s)) return "rest";
  if (/recovery|regeneration|\breko\b/.test(s)) return "recovery";
  return "easy";
}

function extractDistanceKm(summary: string): number | undefined {
  const m = summary.match(/(\d+(?:[.,]\d+)?)\s*(?:km|k\b)/i);
  if (!m) return undefined;
  const value = Number(m[1].replace(",", "."));
  return Number.isFinite(value) && value > 0 && value < 400 ? value : undefined;
}

function toDateOnly(d: Date): string {
  // node-ical returns date-only DTSTARTs as local-midnight Dates; format via
  // local components so the calendar day survives regardless of timezone.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseIcsToSessions(fileText: string): IcsImportResult {
  const parsed = ical.sync.parseICS(fileText);
  const sessions: ParsedIcsSession[] = [];
  const skipped: string[] = [];

  for (const entry of Object.values(parsed)) {
    if (!entry || entry.type !== "VEVENT") continue;
    const summary = String(entry.summary ?? "").trim();
    const label = summary || "(ohne Titel)";

    if (entry.rrule) {
      skipped.push(`Wiederkehrender Termin übersprungen: ${label}`);
      continue;
    }
    if (!(entry.start instanceof Date)) {
      skipped.push(`Termin ohne Datum übersprungen: ${label}`);
      continue;
    }

    const type = inferWorkoutType(summary);
    const durationMin =
      entry.end instanceof Date && entry.end > entry.start && !entry.datetype?.includes("date")
        ? Math.round((entry.end.getTime() - entry.start.getTime()) / 60000)
        : undefined;

    const workout: WorkoutDetails = {
      type,
      sport: type === "cross_training" ? "strength" : "running",
      description: summary || "Importierte Einheit",
      ...(extractDistanceKm(summary) ? { distance_km: extractDistanceKm(summary) } : {}),
      ...(durationMin && durationMin < 12 * 60 ? { duration_min: durationMin } : {}),
      ...(entry.description ? { notes: String(entry.description).slice(0, 2000) } : {}),
    };

    sessions.push({ sessionDate: toDateOnly(entry.start), workout });
  }

  sessions.sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
  return { sessions, skipped };
}
