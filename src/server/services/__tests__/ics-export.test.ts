import ical, { type VEvent } from "node-ical";
import { describe, expect, it } from "vitest";
import { buildIcsForSessions, summaryFor, type IcsSession } from "../ics-export";
import type { WorkoutDetails } from "@/lib/types";

const veventsOf = (ics: string): VEvent[] =>
  Object.values(ical.sync.parseICS(ics)).filter((e): e is VEvent => e?.type === "VEVENT");

const w = (over: Partial<WorkoutDetails>): WorkoutDetails => ({
  type: "easy",
  description: "",
  ...over,
});

describe("buildIcsForSessions", () => {
  it("produces a parseable calendar with all-day events", () => {
    const sessions: IcsSession[] = [
      { id: 1, sessionDate: "2026-07-14", workout: w({ type: "easy", distance_km: 10, pace_range: "5:30" }) },
      { id: 2, sessionDate: "2026-07-16", workout: w({ type: "interval", duration_min: 55 }) },
    ];
    const ics = buildIcsForSessions(sessions, "Test");
    expect(ics).toMatch(/\r\n/); // CRLF line endings
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);

    const events = veventsOf(ics);
    expect(events).toHaveLength(2);

    const byUid = new Map(events.map((e) => [e.uid, e]));
    const first = byUid.get("session-1@turbine-turmweg");
    expect(first?.summary).toBe("Easy 10 km");
    // Date-only DTSTART round-trips to the same calendar day. node-ical returns
    // date-only starts as local midnight, so read local components (as the
    // importer does) — toISOString() would shift the day in +TZ offsets.
    const start = first?.start as Date;
    const localDay = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    expect(localDay).toBe("2026-07-14");
    expect(first?.datetype).toBe("date");
  });

  it("folds long description lines (75-octet limit) and stays parseable", () => {
    const longDesc =
      "Sehr langer Beschreibungstext mit vielen Wörtern der die 75-Oktett-Grenze deutlich überschreitet und daher gefaltet werden muss um RFC 5545 zu genügen";
    const ics = buildIcsForSessions(
      [{ id: 9, sessionDate: "2026-07-14", workout: w({ description: longDesc }) }],
      "Fold",
    );
    // No raw content line exceeds 75 octets.
    for (const line of ics.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    const event = veventsOf(ics)[0];
    expect(event?.description).toContain("75-Oktett-Grenze");
  });

  it("escapes special characters in the summary", () => {
    const ics = buildIcsForSessions(
      [{ id: 1, sessionDate: "2026-07-14", workout: w({ type: "tempo", description: "a;b,c" }) }],
      "Esc",
    );
    expect(ics).toContain("SUMMARY:Tempo");
  });
});

describe("summaryFor", () => {
  it("prefers distance, falls back to duration, then bare label", () => {
    expect(summaryFor(w({ type: "long_run", distance_km: 30 }))).toBe("Long Run 30 km");
    expect(summaryFor(w({ type: "tempo", duration_min: 50 }))).toBe("Tempo 50 min");
    expect(summaryFor(w({ type: "rest" }))).toBe("Rest");
    expect(summaryFor(null)).toBe("Training");
  });
});
