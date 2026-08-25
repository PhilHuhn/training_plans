import { describe, expect, it } from "vitest";
import { DEFAULT_RETURN_KEY, RETURN_TO, parseStravaState } from "../strava-return";

describe("parseStravaState", () => {
  it("reads the id and the return path", () => {
    expect(parseStravaState("42:welcome")).toEqual({ userId: 42, returnPath: "/welcome" });
  });

  it("still accepts the bare-id form used before return paths existed", () => {
    // A login already in flight during a deploy must still complete.
    expect(parseStravaState("42")).toEqual({ userId: 42, returnPath: "/settings" });
  });

  it("falls back to the default path for an unknown key", () => {
    expect(parseStravaState("42:elsewhere").returnPath).toBe(RETURN_TO[DEFAULT_RETURN_KEY]);
  });

  it("refuses to treat an arbitrary path as a destination", () => {
    // state round-trips through Strava, so this is the open-redirect guard.
    expect(parseStravaState("42:https://evil.example.com").returnPath).toBe("/settings");
    expect(parseStravaState("42://evil.example.com").returnPath).toBe("/settings");
  });

  it("reports a missing or malformed id as null rather than NaN", () => {
    expect(parseStravaState(null).userId).toBeNull();
    expect(parseStravaState("").userId).toBeNull();
    expect(parseStravaState("abc:welcome").userId).toBeNull();
    expect(parseStravaState("-3:welcome").userId).toBeNull();
    expect(parseStravaState("0:welcome").userId).toBeNull();
  });

  it("still resolves the return path when the id is unusable", () => {
    // The error redirects need somewhere to send the user.
    expect(parseStravaState("abc:welcome").returnPath).toBe("/welcome");
  });
});
