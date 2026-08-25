import { describe, expect, it } from "vitest";
import { formatVersion, shortCommit } from "../version";

describe("shortCommit", () => {
  it("abbreviates to git's usual seven characters", () => {
    expect(shortCommit("8b7be0ac5e9adbaa8c4d8240be6f38b8a714e15d")).toBe("8b7be0a");
  });

  it("leaves an already-short commit alone", () => {
    expect(shortCommit("8b7be0a")).toBe("8b7be0a");
  });

  it("trims whitespace, which an env var can easily carry", () => {
    expect(shortCommit("  8b7be0ac5e9  ")).toBe("8b7be0a");
  });

  it("is empty for an empty input", () => {
    expect(shortCommit("")).toBe("");
    expect(shortCommit("   ")).toBe("");
  });
});

describe("formatVersion", () => {
  it("shows both parts on a real deploy", () => {
    expect(formatVersion("1.0.0", "8b7be0ac5e9adbaa8c4d8240be6f38b8a714e15d")).toBe(
      "v1.0.0 · 8b7be0a",
    );
  });

  it("shows the version alone locally, where there is no commit", () => {
    expect(formatVersion("1.0.0", "")).toBe("v1.0.0");
  });

  it("shows the commit alone if the version somehow went missing", () => {
    expect(formatVersion("", "8b7be0ac")).toBe("8b7be0a");
  });

  it("returns '' when there is nothing to show, so the caller can omit the element", () => {
    // A colophon reading "v" or "unknown" is worse than no colophon.
    expect(formatVersion("", "")).toBe("");
    expect(formatVersion("  ", "  ")).toBe("");
  });
});
