import { describe, expect, it } from "vitest";
import { SPORT_COLORS, planningSportTheme, sportTheme } from "@/lib/sport-theme";

const KNOWN = [
  "Run", "TrailRun", "VirtualRun",
  "Ride", "VirtualRide", "MountainBikeRide", "EBikeRide",
  "Swim", "Rowing",
  "WeightTraining", "Workout",
  "Yoga", "RockClimbing",
  "Hike", "Walk",
];

describe("sportTheme", () => {
  it("gives every known Strava type a label, colour and icon", () => {
    for (const type of KNOWN) {
      const t = sportTheme(type);
      expect(t.label, type).toBeTruthy();
      expect(t.color, type).toMatch(/^#[0-9A-F]{6}$/i);
      // lucide icons are forwardRef objects, not plain functions.
      expect(t.Icon, type).toBeDefined();
    }
  });

  it("gives every sport its own colour", () => {
    // The old greyscale ramp collapsed 14 sports onto 5 shades via idx % 5, so
    // adjacent bar segments and pie slices merged. No two sports may collide.
    const colors = new Set(KNOWN.map((t) => sportTheme(t).color));
    expect(colors.size).toBe(KNOWN.length);
  });

  it("groups related sports into one family but not one shade", () => {
    expect(sportTheme("Run").family).toBe(sportTheme("TrailRun").family);
    expect(sportTheme("Run").color).not.toBe(sportTheme("TrailRun").color);
    expect(sportTheme("Run").family).not.toBe(sportTheme("Ride").family);
    expect(sportTheme("Run").Icon).not.toBe(sportTheme("TrailRun").Icon);
  });

  it("falls back cleanly for an unknown type without implying running", () => {
    const t = sportTheme("Kitesurf");
    expect(t.label).toBe("Kitesurf");
    expect(t.color).toBe(SPORT_COLORS.other);
    expect(t.Icon).not.toBe(sportTheme("Run").Icon);
  });

  it("handles an empty activity type", () => {
    expect(sportTheme("").label).toBe("Other");
  });

  it("covers the sports that used to be missing entirely", () => {
    // RockClimbing was absent from every map; Yoga and Workout had no icon.
    for (const type of ["RockClimbing", "Yoga", "Workout"]) {
      expect(sportTheme(type).Icon).not.toBe(sportTheme("Kitesurf").Icon);
    }
  });
});

describe("planningSportTheme", () => {
  it("maps the lowercase planning taxonomy onto the same colours", () => {
    expect(planningSportTheme("running").color).toBe(sportTheme("Run").color);
    expect(planningSportTheme("cycling").color).toBe(sportTheme("Ride").color);
    expect(planningSportTheme("running").label).toBe("Running");
  });

  it("falls back for an unknown planning sport", () => {
    expect(planningSportTheme("padel").color).toBe(SPORT_COLORS.other);
  });
});
