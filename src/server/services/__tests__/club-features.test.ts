import { describe, expect, it } from "vitest";
import { clubFeatures, sanitizeClubTheme } from "../club-features";

describe("clubFeatures gate", () => {
  it("enables theme + sponsor only on the paid tier", () => {
    expect(clubFeatures({ planTier: "paid" })).toEqual({ theming: true, sponsor: true });
    expect(clubFeatures({ planTier: "free" })).toEqual({ theming: false, sponsor: false });
  });
});

describe("sanitizeClubTheme (CSS injection guard)", () => {
  it("passes valid hex colors and https logo URLs", () => {
    expect(
      sanitizeClubTheme({
        primary: "#0B5A38",
        accent: "#C8471B",
        background: "#fff",
        logoUrl: "https://cdn.example/logo.png",
      }),
    ).toEqual({
      primary: "#0B5A38",
      accent: "#C8471B",
      background: "#fff",
      logo_url: "https://cdn.example/logo.png",
    });
  });

  it("drops non-hex values and non-https/unsafe URLs", () => {
    expect(
      sanitizeClubTheme({
        primary: "red; background: url(evil)",
        accent: "rgb(0,0,0)",
        background: "#GGGGGG",
        logoUrl: "http://insecure.example/logo.png",
      }),
    ).toBeNull();
    expect(
      sanitizeClubTheme({ logoUrl: "https://evil.example/a\")');behavior:url(x" }),
    ).toBeNull();
  });

  it("returns null for empty/absent themes", () => {
    expect(sanitizeClubTheme(null)).toBeNull();
    expect(sanitizeClubTheme({})).toBeNull();
  });
});
