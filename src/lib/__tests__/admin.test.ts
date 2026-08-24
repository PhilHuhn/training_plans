import { describe, expect, it } from "vitest";
import { isPlatformAdmin, parseAdminEmails } from "@/lib/admin";

describe("parseAdminEmails", () => {
  it("normalizes case, trims, and drops empties", () => {
    const set = parseAdminEmails(" Owner@Example.com , , second@example.com ");
    expect([...set].sort()).toEqual(["owner@example.com", "second@example.com"]);
  });

  it("treats an unset value as no admins", () => {
    expect(parseAdminEmails(undefined).size).toBe(0);
    expect(parseAdminEmails("").size).toBe(0);
  });
});

describe("isPlatformAdmin", () => {
  const allowlist = parseAdminEmails("owner@example.com");

  it("grants via the env allowlist regardless of case", () => {
    expect(isPlatformAdmin({ email: "Owner@Example.com", isAdmin: false }, allowlist)).toBe(true);
  });

  it("grants via the database flag", () => {
    expect(isPlatformAdmin({ email: "someone@example.com", isAdmin: true }, allowlist)).toBe(true);
  });

  it("denies an ordinary user", () => {
    expect(isPlatformAdmin({ email: "athlete@example.com", isAdmin: false }, allowlist)).toBe(false);
  });

  it("denies everyone when the allowlist is empty and no flag is set", () => {
    expect(isPlatformAdmin({ email: "owner@example.com", isAdmin: false }, parseAdminEmails(""))).toBe(false);
  });
});
