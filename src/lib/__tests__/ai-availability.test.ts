import { describe, expect, it } from "vitest";
import {
  AI_UNCONFIGURED_NOTICE,
  DEFAULT_AI_DISABLED_NOTICE,
  parseAiSettings,
  resolveAiAvailability,
} from "@/lib/ai-availability";

describe("resolveAiAvailability", () => {
  it("is available when enabled and a key is configured", () => {
    const r = resolveAiAvailability({ enabled: true, notice: "off", hasApiKey: true });
    expect(r).toEqual({ available: true, notice: null });
  });

  it("is unavailable when the operator switched it off, with their notice", () => {
    const r = resolveAiAvailability({ enabled: false, notice: "Back in March.", hasApiKey: true });
    expect(r.available).toBe(false);
    expect(r.notice).toBe("Back in March.");
  });

  it("falls back to the default notice when the operator blanked it", () => {
    const r = resolveAiAvailability({ enabled: false, notice: "   ", hasApiKey: true });
    expect(r.notice).toBe(DEFAULT_AI_DISABLED_NOTICE);
  });

  it("treats a missing API key as unavailable even when the flag is on", () => {
    // Clearing the key in the host's env must be a working kill switch on its
    // own — otherwise the UI offers a button that can only fail upstream.
    const r = resolveAiAvailability({ enabled: true, notice: "unused", hasApiKey: false });
    expect(r.available).toBe(false);
    expect(r.notice).toBe(AI_UNCONFIGURED_NOTICE);
  });

  it("reports the missing key rather than the operator's notice", () => {
    const r = resolveAiAvailability({ enabled: false, notice: "Back in March.", hasApiKey: false });
    expect(r.notice).toBe(AI_UNCONFIGURED_NOTICE);
  });
});

describe("parseAiSettings", () => {
  it("reads a well-formed row", () => {
    expect(parseAiSettings({ enabled: false, notice: "Paused." })).toEqual({
      enabled: false,
      notice: "Paused.",
      // Rows written before the provider switch have no model — they keep
      // using whatever the provider default is, which is what they had.
      model: "",
    });
  });

  it("defaults to enabled when the row is absent or junk", () => {
    for (const junk of [null, undefined, 42, "nope", {}]) {
      expect(parseAiSettings(junk).enabled).toBe(true);
    }
  });

  it("substitutes the default notice for an empty one", () => {
    expect(parseAiSettings({ enabled: false, notice: "" }).notice).toBe(DEFAULT_AI_DISABLED_NOTICE);
  });
});

describe("parseAiSettings — model", () => {
  it("round-trips an operator-chosen model", () => {
    expect(parseAiSettings({ model: "anthropic/claude-sonnet-4.5" }).model).toBe(
      "anthropic/claude-sonnet-4.5",
    );
  });

  it("trims it, so a stray space cannot become an unroutable model id", () => {
    expect(parseAiSettings({ model: "  openai/gpt-4o-mini  " }).model).toBe("openai/gpt-4o-mini");
  });

  it("ignores a non-string model", () => {
    expect(parseAiSettings({ model: 42 }).model).toBe("");
  });
});
