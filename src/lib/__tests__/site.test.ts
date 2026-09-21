import { describe, expect, it } from "vitest";
import { emailAddress, site } from "../site";

describe("site.kofi", () => {
  it("points at the account it names", () => {
    // The URL is written out rather than derived, so that editing one and not
    // the other sends donations to a stranger — or to a 404. This is the guard.
    expect(site.kofi.url).toBe(`https://ko-fi.com/${site.kofi.username}`);
  });

  it("is https and carries nothing beyond the profile path", () => {
    const url = new URL(site.kofi.url);
    expect(url.protocol).toBe("https:");
    expect(url.hostname).toBe("ko-fi.com");
    // No query string: a tracking or referral parameter here would need
    // disclosing in the privacy policy, which describes a plain link.
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
  });
});

describe("site", () => {
  it("assembles the contact address from its two halves", () => {
    expect(emailAddress).toBe(`${site.email.user}@${site.email.domain}`);
  });

  it("carries a parseable last-updated date for the legal pages", () => {
    // Rendered with toLocaleDateString, which prints "Invalid Date" rather
    // than throwing — so a typo here would ship silently onto the imprint.
    expect(Number.isNaN(new Date(site.lastUpdated).getTime())).toBe(false);
  });
});
