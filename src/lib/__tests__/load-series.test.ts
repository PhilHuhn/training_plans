import { describe, expect, it } from "vitest";
import {
  ATL_TIME_CONSTANT_DAYS,
  CTL_TIME_CONSTANT_DAYS,
  buildLoadSeries,
  isoDay,
  splitForChart,
  type LoadPoint,
} from "../load-series";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** A series over one span with no warm-up, for readable assertions. */
function series(trimp: Record<string, number>, from: string, to: string, projectFrom?: string) {
  return buildLoadSeries({
    trimpByDay: new Map(Object.entries(trimp)),
    computeFrom: day(from),
    emitFrom: day(from),
    emitTo: day(to),
    projectFrom: projectFrom ? day(projectFrom) : undefined,
  });
}

describe("buildLoadSeries", () => {
  it("emits one point per day, inclusive of both ends", () => {
    const points = series({}, "2026-01-01", "2026-01-05");
    expect(points.map((p) => p.date)).toEqual([
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
      "2026-01-05",
    ]);
  });

  it("applies the day's load with the documented time constants", () => {
    // One 100-TRIMP day from zero: ctl = 100 * (1 - e^(-1/42)).
    const [first] = series({ "2026-01-01": 100 }, "2026-01-01", "2026-01-01");
    const expectedCtl = 100 * (1 - Math.exp(-1 / CTL_TIME_CONSTANT_DAYS));
    const expectedAtl = 100 * (1 - Math.exp(-1 / ATL_TIME_CONSTANT_DAYS));
    expect(first.ctl).toBeCloseTo(Math.round(expectedCtl * 10) / 10, 5);
    expect(first.atl).toBeCloseTo(Math.round(expectedAtl * 10) / 10, 5);
  });

  it("reads form before applying the day's load, so it is the freshness carried in", () => {
    // Day 1 starts from nothing, so its form is 0 even though it carries load.
    // Day 2's form reflects day 1 only.
    const points = series({ "2026-01-01": 100 }, "2026-01-01", "2026-01-02");
    expect(points[0].tsb).toBe(0);
    // Within a rounding step: tsb rounds the difference, while ctl and atl are
    // each rounded before being subtracted here.
    expect(points[1].tsb).toBeCloseTo(points[0].ctl - points[0].atl, 0);
    // A hard day leaves you in the hole the morning after.
    expect(points[1].tsb).toBeLessThan(0);
  });

  it("sheds fatigue far faster than fitness across a rest block", () => {
    const points = series({ "2026-01-01": 200 }, "2026-01-01", "2026-01-15");
    const first = points[0];
    const last = points[points.length - 1];

    expect(last.atl).toBeLessThan(first.atl);
    expect(last.atl).toBeGreaterThan(0);

    // The comparison that matters is proportional, not absolute. From a single
    // hard day the two curves have not yet crossed a fortnight later (atl 3.6
    // still sits above ctl 3.4) because atl spiked so much higher to begin
    // with — but it has given back almost all of it while ctl has barely moved.
    const ctlRetained = last.ctl / first.ctl;
    const atlRetained = last.atl / first.atl;
    expect(atlRetained).toBeLessThan(ctlRetained / 2);
  });

  it("seeds the averages from days before the emitted window", () => {
    // Same load, but one series starts computing a fortnight earlier. The warm-up
    // is what stops the curve beginning at zero on the first visible day.
    const trimpByDay = new Map([["2026-01-01", 300]]);
    const cold = buildLoadSeries({
      trimpByDay,
      computeFrom: day("2026-01-10"),
      emitFrom: day("2026-01-10"),
      emitTo: day("2026-01-10"),
    });
    const warm = buildLoadSeries({
      trimpByDay,
      computeFrom: day("2026-01-01"),
      emitFrom: day("2026-01-10"),
      emitTo: day("2026-01-10"),
    });
    expect(cold[0].ctl).toBe(0);
    expect(warm[0].ctl).toBeGreaterThan(0);
    expect(warm).toHaveLength(1);
  });

  it("marks days from projectFrom onward, and nothing before", () => {
    const points = series({}, "2026-01-01", "2026-01-05", "2026-01-04");
    expect(points.map((p) => p.projected)).toEqual([false, false, false, true, true]);
  });

  it("marks nothing when projectFrom is omitted", () => {
    expect(series({}, "2026-01-01", "2026-01-03").every((p) => !p.projected)).toBe(true);
  });

  it("projects a day with no planned session as rest, not as a gap", () => {
    const points = series({ "2026-01-01": 150 }, "2026-01-01", "2026-01-04", "2026-01-02");
    const tail = points.filter((p) => p.projected);
    expect(tail).toHaveLength(3);
    // Every projected day still carries numbers — decaying, not absent.
    for (const p of tail) {
      expect(p.trimp).toBe(0);
      expect(p.ctl).toBeGreaterThan(0);
    }
    expect(tail[2].atl).toBeLessThan(tail[0].atl);
  });

  it("folds planned load into the projection", () => {
    const rested = series({ "2026-01-01": 100 }, "2026-01-01", "2026-01-04", "2026-01-02");
    const trained = series(
      { "2026-01-01": 100, "2026-01-03": 200 },
      "2026-01-01",
      "2026-01-04",
      "2026-01-02",
    );
    // The planned session on the 3rd must lift fatigue and depress form.
    expect(trained[3].atl).toBeGreaterThan(rested[3].atl);
    expect(trained[3].tsb).toBeLessThan(rested[3].tsb);
  });

  it("returns [] when the range runs backwards", () => {
    expect(series({}, "2026-01-05", "2026-01-01")).toEqual([]);
  });

  it("emits a whole day range even when the bounds carry a time of day", () => {
    // Callers pass `new Date()`-derived bounds. Stepping 24h from an afternoon
    // timestamp never lands on midnight, so an inclusive midnight `emitTo` used
    // to drop the final day — a 7-day forecast that delivered 6.
    const points = buildLoadSeries({
      trimpByDay: new Map(),
      computeFrom: new Date("2026-01-01T16:40:00.000Z"),
      emitFrom: new Date("2026-01-01T16:40:00.000Z"),
      emitTo: new Date("2026-01-08T00:00:00.000Z"),
    });
    expect(points).toHaveLength(8);
    expect(points[points.length - 1].date).toBe("2026-01-08");
  });

  it("counts exactly the requested number of projected days", () => {
    const today = new Date("2026-03-10T13:05:00.000Z");
    const points = buildLoadSeries({
      trimpByDay: new Map(),
      computeFrom: new Date("2026-02-01T13:05:00.000Z"),
      emitFrom: new Date("2026-03-01T13:05:00.000Z"),
      emitTo: new Date(Date.UTC(2026, 2, 10 + 7)),
      projectFrom: new Date(Date.UTC(2026, 2, 11)),
    });
    expect(points.filter((p) => p.projected)).toHaveLength(7);
    expect(points.find((p) => p.projected)?.date).toBe("2026-03-11");
    expect(points[points.length - 1].date).toBe("2026-03-17");
    expect(isoDay(today)).toBe("2026-03-10");
  });
});

describe("splitForChart", () => {
  const points: LoadPoint[] = series(
    { "2026-01-01": 100, "2026-01-04": 80 },
    "2026-01-01",
    "2026-01-05",
    "2026-01-04",
  );

  it("puts the boundary day on both lines, so they meet", () => {
    // This is the bug the boundary exists to prevent: without it the measured
    // line ends on the 3rd, the projected line starts on the 4th, and the chart
    // shows a one-day gap where the two should join.
    const split = splitForChart(points);
    const boundary = split.find((p) => p.date === "2026-01-03")!;
    expect(boundary.ctl).not.toBeNull();
    expect(boundary.ctl_projected).not.toBeNull();
    expect(boundary.ctl_projected).toBe(boundary.ctl);
  });

  it("keeps measured days off the projected line and vice versa", () => {
    const split = splitForChart(points);
    const measured = split.find((p) => p.date === "2026-01-02")!;
    expect(measured.ctl).not.toBeNull();
    expect(measured.ctl_projected).toBeNull();

    const projected = split.find((p) => p.date === "2026-01-05")!;
    expect(projected.ctl).toBeNull();
    expect(projected.ctl_projected).not.toBeNull();
  });

  it("splits all three metrics the same way", () => {
    const projected = splitForChart(points).find((p) => p.date === "2026-01-05")!;
    expect([projected.ctl, projected.atl, projected.tsb]).toEqual([null, null, null]);
    for (const v of [projected.ctl_projected, projected.atl_projected, projected.tsb_projected]) {
      expect(v).not.toBeNull();
    }
  });

  it("leaves every projected key null when nothing is projected", () => {
    const split = splitForChart(series({ "2026-01-01": 50 }, "2026-01-01", "2026-01-03"));
    expect(split.every((p) => p.ctl_projected === null)).toBe(true);
    expect(split.every((p) => p.ctl !== null)).toBe(true);
  });

  it("handles a series that is projected from its very first day", () => {
    // No measured day to anchor to — the projected line simply starts alone
    // rather than reaching back to index -1.
    const split = splitForChart(series({}, "2026-01-01", "2026-01-03", "2026-01-01"));
    expect(split.every((p) => p.ctl === null)).toBe(true);
    expect(split.every((p) => p.ctl_projected !== null)).toBe(true);
  });

  it("preserves the day count", () => {
    expect(splitForChart(points)).toHaveLength(points.length);
  });
});

describe("isoDay", () => {
  it("is the UTC calendar day", () => {
    expect(isoDay(new Date("2026-08-25T22:13:00.000Z"))).toBe("2026-08-25");
  });
});
