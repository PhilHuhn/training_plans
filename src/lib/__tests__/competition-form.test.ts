import { describe, expect, it } from "vitest";
import {
  MAX_GOAL_SECONDS,
  competitionPayload,
  goalTimeToParts,
  goalTimeToSeconds,
  isCompetitionFormValid,
  type CompetitionFormState,
} from "../competition-form";

const form = (over: Partial<CompetitionFormState> = {}): CompetitionFormState => ({
  name: "Berlin Marathon",
  raceType: "M",
  raceDate: "2026-09-27",
  priority: "A",
  location: "Berlin",
  goalTimeH: "3",
  goalTimeM: "0",
  goalTimeS: "0",
  notes: "Sub-3 attempt",
  ...over,
});

describe("goalTimeToSeconds", () => {
  it("adds the three inputs together", () => {
    expect(goalTimeToSeconds({ h: "3", m: "15", s: "30" })).toBe(3 * 3600 + 15 * 60 + 30);
  });

  it("treats blank components as zero", () => {
    expect(goalTimeToSeconds({ h: "", m: "45", s: "" })).toBe(45 * 60);
  });

  it("is null when every box is empty", () => {
    // Null, not undefined: on an edit this has to mean "remove the goal I had",
    // and the update route skips undefined fields.
    expect(goalTimeToSeconds({ h: "", m: "", s: "" })).toBeNull();
    expect(goalTimeToSeconds({ h: "  ", m: "", s: " " })).toBeNull();
  });

  it("is null when the boxes hold only zeros", () => {
    expect(goalTimeToSeconds({ h: "0", m: "0", s: "0" })).toBeNull();
  });

  it("clamps an absurd value instead of overflowing the column", () => {
    // The hours input has no upper bound. Past int4 this used to reach the
    // driver and surface as a 500 rather than anything actionable.
    expect(goalTimeToSeconds({ h: "999999", m: "", s: "" })).toBe(MAX_GOAL_SECONDS);
    expect(goalTimeToSeconds({ h: "24", m: "0", s: "1" })).toBe(MAX_GOAL_SECONDS);
    expect(MAX_GOAL_SECONDS).toBeLessThan(2_147_483_647);
  });

  it("ignores junk rather than producing NaN", () => {
    expect(goalTimeToSeconds({ h: "abc", m: "10", s: "" })).toBe(600);
    expect(goalTimeToSeconds({ h: "-5", m: "10", s: "" })).toBe(600);
  });
});

describe("goalTimeToParts", () => {
  it("splits a stored time back into the three inputs", () => {
    expect(goalTimeToParts(3 * 3600 + 15 * 60 + 30)).toEqual({ h: "3", m: "15", s: "30" });
  });

  it("is blank for no goal", () => {
    expect(goalTimeToParts(null)).toEqual({ h: "", m: "", s: "" });
    expect(goalTimeToParts(undefined)).toEqual({ h: "", m: "", s: "" });
    expect(goalTimeToParts(0)).toEqual({ h: "", m: "", s: "" });
  });

  it("round-trips with goalTimeToSeconds", () => {
    // This pair is what makes an edit non-destructive: open the dialog, change
    // nothing, save, and the stored goal must be identical.
    for (const seconds of [60, 3600, 10800, 3 * 3600 + 15 * 60 + 30, 86_399]) {
      expect(goalTimeToSeconds(goalTimeToParts(seconds))).toBe(seconds);
    }
  });
});

describe("competitionPayload", () => {
  it("carries the required fields through", () => {
    expect(competitionPayload(form())).toMatchObject({
      name: "Berlin Marathon",
      race_type: "M",
      race_date: "2026-09-27",
      priority: "A",
    });
  });

  it("sends null — not undefined — for a cleared optional field", () => {
    // The regression this module exists for. The update route applies a field
    // only when it is not undefined, so `location || undefined` meant an
    // emptied box silently kept its previous value: you could add a location
    // but never remove one.
    const payload = competitionPayload(form({ location: "", notes: "" }));
    expect(payload.location).toBeNull();
    expect(payload.notes).toBeNull();
    expect("location" in payload).toBe(true);
  });

  it("sends null for a cleared goal time", () => {
    const payload = competitionPayload(form({ goalTimeH: "", goalTimeM: "", goalTimeS: "" }));
    expect(payload.goal_time).toBeNull();
  });

  it("treats whitespace as cleared", () => {
    const payload = competitionPayload(form({ location: "   ", notes: "\n\t " }));
    expect(payload.location).toBeNull();
    expect(payload.notes).toBeNull();
  });

  it("trims the values it does send", () => {
    const payload = competitionPayload(form({ name: "  Berlin  ", location: " Berlin " }));
    expect(payload.name).toBe("Berlin");
    expect(payload.location).toBe("Berlin");
  });

  it("does not send distance or elevation, which the dialog cannot edit", () => {
    // Absent, not null — the update route leaves an absent field alone, so a
    // race's distance survives an edit rather than being wiped by a form that
    // never showed it.
    const payload = competitionPayload(form());
    expect(payload.distance).toBeUndefined();
    expect(payload.elevation_gain).toBeUndefined();
    expect("distance" in payload).toBe(false);
    expect("elevation_gain" in payload).toBe(false);
  });
});

describe("isCompetitionFormValid", () => {
  it("requires a name and a real date", () => {
    expect(isCompetitionFormValid(form())).toBe(true);
    expect(isCompetitionFormValid(form({ name: "  " }))).toBe(false);
    expect(isCompetitionFormValid(form({ raceDate: "" }))).toBe(false);
    expect(isCompetitionFormValid(form({ raceDate: "27/09/2026" }))).toBe(false);
  });
});
