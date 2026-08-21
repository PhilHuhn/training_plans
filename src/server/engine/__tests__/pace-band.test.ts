import { describe, expect, it } from "vitest";
import { calculatePaceZonesFromThreshold } from "@/lib/zone-calc";
import {
  easyPaceRange,
  sharedEasyPace,
  thresholdPaceOf,
  thresholdSpread,
  typicalEasyPace,
} from "../pace-band";
import type { EngineMember } from "../types";

const member = (id: number, over: Partial<EngineMember> = {}): EngineMember => ({
  id,
  name: `M${id}`,
  visibility: "full",
  thresholdPaceSec: null,
  paceZones: null,
  ...over,
});

describe("easyPaceRange", () => {
  it("derives the band from pace zones 1–2 (min = slower convention)", () => {
    const m = member(1, { paceZones: calculatePaceZonesFromThreshold(300) });
    const range = easyPaceRange(m);
    // zone1 min = floor(300*1.35) = 405; zone2 max = floor(300*1.05)+1 = 316.
    expect(range).toEqual({ slow: 405, fast: 316 });
  });

  it("is robust against min/max inversion in stored zones", () => {
    const m = member(1, {
      paceZones: {
        zone1: { min: 346, max: 405 }, // inverted on purpose
        zone2: { min: 316, max: 345 },
      },
    });
    expect(easyPaceRange(m)).toEqual({ slow: 405, fast: 316 });
  });

  it("falls back to threshold-pace-derived zones", () => {
    const viaZones = easyPaceRange(member(1, { paceZones: calculatePaceZonesFromThreshold(280) }));
    const viaThreshold = easyPaceRange(member(2, { thresholdPaceSec: 280 }));
    expect(viaThreshold).toEqual(viaZones);
  });

  it("returns null without any pace data", () => {
    expect(easyPaceRange(member(1))).toBeNull();
    expect(typicalEasyPace(member(1))).toBeNull();
  });
});

describe("thresholdPaceOf / thresholdSpread", () => {
  it("prefers the explicit threshold pace, falls back to zone-4 midpoint", () => {
    expect(thresholdPaceOf(member(1, { thresholdPaceSec: 275 }))).toBe(275);
    const zones = calculatePaceZonesFromThreshold(300);
    const m = member(2, { paceZones: zones });
    expect(thresholdPaceOf(m)).toBe(Math.round((zones.zone4.min + zones.zone4.max) / 2));
    expect(thresholdPaceOf(member(3))).toBeNull();
  });

  it("spread is max pairwise difference; Infinity when data is missing", () => {
    const a = member(1, { thresholdPaceSec: 250 });
    const b = member(2, { thresholdPaceSec: 275 });
    expect(thresholdSpread([a, b])).toBe(25);
    expect(thresholdSpread([a, member(3)])).toBe(Infinity);
  });
});

describe("sharedEasyPace", () => {
  it("uses the slowest member's typical easy pace when it fits everyone", () => {
    const fast = member(1, { thresholdPaceSec: 250 });
    const slow = member(2, { thresholdPaceSec: 305 });
    const result = sharedEasyPace([fast, slow]);
    expect(result).not.toBeNull();
    expect(result?.memberIds).toEqual([1, 2]);
    // Slowest member's zone-2 midpoint.
    expect(result?.sharedPaceSecPerKm).toBe(typicalEasyPace(slow));
  });

  it("excludes members whose easy band cannot contain the shared pace", () => {
    // Very fast member: easy band tops out at 300 sec/km.
    const sprinter = member(1, {
      paceZones: {
        zone1: { min: 300, max: 281 },
        zone2: { min: 280, max: 260 },
      },
    });
    const slow = member(2, { thresholdPaceSec: 305 }); // typical easy ≈ 336
    // Shared pace 336 doesn't fit the sprinter → only one member left → null.
    expect(sharedEasyPace([sprinter, slow])).toBeNull();

    // With a third compatible slow runner, the sprinter is excluded but the
    // other two still share.
    const slow2 = member(3, { thresholdPaceSec: 290 });
    const result = sharedEasyPace([sprinter, slow, slow2]);
    expect(result?.memberIds).toEqual([2, 3]);
  });

  it("never pace-shares members without pace data", () => {
    const noData = member(1);
    const slow = member(2, { thresholdPaceSec: 305 });
    expect(sharedEasyPace([noData, slow])).toBeNull();
    const result = sharedEasyPace([noData, slow, member(3, { thresholdPaceSec: 300 })]);
    expect(result?.memberIds).toEqual([2, 3]);
  });
});
