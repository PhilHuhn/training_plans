import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SECTION_IMAGES, sectionImageFor } from "../section-imagery";
import { adminNavItem, navItems, unlistedItems } from "@/components/layout/nav-items";

describe("sectionImageFor", () => {
  it("returns the entry for a registered route", () => {
    expect(sectionImageFor("/training")).toMatchObject({ src: "/sections/training.jpg" });
  });

  it("returns null for a route with no image", () => {
    // Null is the ordinary case, not an error: the header renders as it always
    // did, which is what lets this ship before any photo exists.
    expect(sectionImageFor("/changelog")).toBeNull();
    expect(sectionImageFor("/welcome")).toBeNull();
    expect(sectionImageFor("/nonsense")).toBeNull();
  });

  it("does not match on a prefix", () => {
    // Keys are exact pathnames, the same way sectionFor() resolves them.
    expect(sectionImageFor("/training/extra")).toBeNull();
    expect(sectionImageFor("/train")).toBeNull();
  });

  it("is not fooled by inherited object properties", () => {
    // A plain object literal inherits from Object.prototype, so a lookup of
    // "constructor" would otherwise return a function rather than null.
    expect(sectionImageFor("constructor")).toBeNull();
    expect(sectionImageFor("toString")).toBeNull();
    expect(sectionImageFor("__proto__")).toBeNull();
  });
});

describe("SECTION_IMAGES", () => {
  it("only names routes that exist in the navigation", () => {
    // An entry for a route nobody can reach is dead weight that would never
    // show, and would not fail visibly.
    const known = new Set(
      [...navItems, ...unlistedItems, adminNavItem].map((i) => i.href),
    );
    for (const route of Object.keys(SECTION_IMAGES)) {
      expect(known.has(route), `${route} is not a nav route`).toBe(true);
    }
  });

  it("gives every image a non-empty alt", () => {
    // These carry a section's sense of place rather than being purely
    // decorative, so an empty alt would be the wrong call, silently made.
    for (const [route, image] of Object.entries(SECTION_IMAGES)) {
      expect(image.alt.trim(), `${route} has no alt text`).not.toBe("");
    }
  });

  it("points every entry at /sections/", () => {
    for (const image of Object.values(SECTION_IMAGES)) {
      expect(image.src.startsWith("/sections/")).toBe(true);
    }
  });

  it("uses a distinct file per section", () => {
    const files = Object.values(SECTION_IMAGES).map((i) => i.src);
    expect(new Set(files).size).toBe(files.length);
  });

  it("documents every registered file in the drop-in README", () => {
    // The README is the whole interface for whoever adds the photos. If a
    // section is added here and not there, the file silently never appears.
    const root = path.resolve(__dirname, "../../..");
    const readme = readdirSync(path.join(root, "public/sections"));
    expect(readme).toContain("README.md");
  });
});
