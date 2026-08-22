import { describe, expect, it } from "vitest";
import { inferWorkoutType, parseIcsToSessions } from "../ics-import";
import { buildIcsForSessions, type IcsSession } from "../ics-export";
import type { WorkoutDetails } from "@/lib/types";

const CRLF = "\r\n";
const cal = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//test//EN", ...events, "END:VCALENDAR"].join(CRLF);

const vevent = (fields: Record<string, string>) =>
  ["BEGIN:VEVENT", ...Object.entries(fields).map(([k, v]) => `${k}:${v}`), "END:VEVENT"].join(CRLF);

describe("inferWorkoutType", () => {
  it("maps English and German summary keywords", () => {
    expect(inferWorkoutType("6x1000 Intervalle")).toBe("interval");
    expect(inferWorkoutType("Tempolauf 25 min")).toBe("tempo");
    expect(inferWorkoutType("Schwellenlauf")).toBe("tempo");
    expect(inferWorkoutType("Langer Lauf 30km")).toBe("long_run");
    expect(inferWorkoutType("Krafttraining")).toBe("cross_training");
    expect(inferWorkoutType("Ruhetag")).toBe("rest");
    expect(inferWorkoutType("Wettkampf 10k")).toBe("race");
    expect(inferWorkoutType("Lockerer Dauerlauf")).toBe("easy");
  });
});

describe("parseIcsToSessions", () => {
  it("parses plain VEVENTs into planned sessions with date + distance", () => {
    const ics = cal(
      vevent({ UID: "a@x", "DTSTART;VALUE=DATE": "20260714", SUMMARY: "Intervalle 6x1000" }),
      vevent({ UID: "b@x", "DTSTART;VALUE=DATE": "20260716", SUMMARY: "Langer Lauf 30 km" }),
    );
    const { sessions, skipped } = parseIcsToSessions(ics);
    expect(skipped).toEqual([]);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]).toMatchObject({ sessionDate: "2026-07-14", workout: { type: "interval" } });
    expect(sessions[1].workout).toMatchObject({ type: "long_run", distance_km: 30 });
  });

  it("skips recurring events with a warning", () => {
    const ics = cal(
      vevent({
        UID: "r@x",
        "DTSTART;VALUE=DATE": "20260714",
        RRULE: "FREQ=WEEKLY;COUNT=4",
        SUMMARY: "Weekly run",
      }),
    );
    const { sessions, skipped } = parseIcsToSessions(ics);
    expect(sessions).toHaveLength(0);
    expect(skipped[0]).toMatch(/Recurring event skipped/);
  });

  it("round-trips with the exporter (dates + types survive)", () => {
    const src: IcsSession[] = [
      { id: 1, sessionDate: "2026-07-14", workout: { type: "tempo", description: "Tempo", duration_min: 50 } as WorkoutDetails },
      { id: 2, sessionDate: "2026-07-19", workout: { type: "long_run", description: "Long", distance_km: 22 } as WorkoutDetails },
    ];
    const ics = buildIcsForSessions(src, "Roundtrip");
    const { sessions } = parseIcsToSessions(ics);
    expect(sessions.map((s) => s.sessionDate)).toEqual(["2026-07-14", "2026-07-19"]);
    expect(sessions[0].workout.type).toBe("tempo");
    expect(sessions[1].workout.type).toBe("long_run");
  });
});
