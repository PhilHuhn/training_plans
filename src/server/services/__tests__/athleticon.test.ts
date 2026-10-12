import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATHLETICON_ORIGIN,
  athleticonDocumentUrl,
  isAthleticonDocumentPath,
  parseAthleticonEvents,
} from "@/lib/athleticon";

// The portal's landing page as served on 2026-10-12 (utf-8), saved byte for
// byte with curl. Decoded here the way the service does it.
const html = new TextDecoder("utf-8").decode(
  readFileSync(path.join(__dirname, "fixtures", "athleticon-index.html")),
);

describe("parseAthleticonEvents against the saved portal page", () => {
  const events = parseAthleticonEvents(html);

  it("reads every row of the announcements table and nothing else", () => {
    expect(events).toHaveLength(9);
  });

  it("gets the first and last event right", () => {
    expect(events[0]).toEqual({
      slug: "2026-10-17-werferserie-2026-2027",
      title: "Werferserie 2026-2027",
      date: "2026-10-17",
      entryDeadline: "2026-10-14T18:00",
      updatedAt: "2026-09-28T11:01",
      registrationUrl: undefined,
      documentPath: "/public/ausschreibung/Leichtathletik/20261017-0%20Werferserie%202026-2027.pdf",
    });
    expect(events.at(-1)).toMatchObject({
      slug: "2027-04-03-wald-und-crosslaufserie-2026-2027",
      title: "Wald- und Crosslaufserie 2026-2027",
      date: "2027-04-03",
      entryDeadline: "2026-10-07T18:00",
    });
  });

  it("produces valid ISO dates and unique slugs", () => {
    for (const e of events) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${e.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(e.date);
      if (e.entryDeadline) expect(e.entryDeadline).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    }
    expect(new Set(events.map((e) => e.slug)).size).toBe(events.length);
  });

  it("leaves the deadline out where the portal shows a dash", () => {
    expect(events.find((e) => e.title === "Terminplan 2026")?.entryDeadline).toBeUndefined();
  });

  it("decodes umlauts, in entities and in the document path", () => {
    const cross = events.find((e) => e.date === "2026-11-14");
    expect(cross?.title).toBe("Crosslauf Sülldorf 2026");
    expect(cross?.slug).toBe("2026-11-14-crosslauf-suelldorf-2026");
    expect(decodeURIComponent(cross!.documentPath!)).toContain("Crosslauf Sülldorf 2026.pdf");
  });

  it("joins the guest registration link from the entries table", () => {
    expect(events.find((e) => e.title === "Speicherstadtlauf 2026")?.registrationUrl).toBe(
      `${ATHLETICON_ORIGIN}/public/anmelden.php?lauf=586`,
    );
    expect(events.filter((e) => e.registrationUrl)).toHaveLength(5);
  });

  it("only ever yields document paths that pass the guard", () => {
    for (const e of events) {
      expect(e.documentPath).toBeDefined();
      expect(isAthleticonDocumentPath(e.documentPath!)).toBe(true);
      expect(e.documentPath).not.toMatch(/meldelisten|ergebnisse/);
    }
  });
});

describe("isAthleticonDocumentPath", () => {
  it.each([
    "../../etc/passwd",
    "/public/ausschreibung/Leichtathletik/../../index.php",
    "/public/ausschreibung/Leichtathletik/%2e%2e/x.pdf",
    "/public/ausschreibung/Leichtathletik/..%2Fx.pdf",
    "/public/ausschreibung/Leichtathletik/..%5Cx.pdf",
    "//evil.example/x.pdf",
    "https://evil.example/x.pdf",
    "https://athleticon.bsvhh.de.evil.example/public/ausschreibung/Leichtathletik/x.pdf",
    "/public/meldelisten/Leichtathletik/x.pdf",
    "/public/ergebnisse/Leichtathletik/x.pdf",
    "/public/ausschreibung/Leichtathletik/x.php",
    "/public/ausschreibung/Leichtathletik/x.pdf?y=.pdf/../z",
    "/public/ausschreibung/Leichtathletik/%E0%A4%A.pdf",
    "",
  ])("rejects %j", (candidate) => {
    expect(isAthleticonDocumentPath(candidate)).toBe(false);
  });

  it("builds the upstream URL on the portal's own origin", () => {
    const url = athleticonDocumentUrl(
      "/public/ausschreibung/Leichtathletik/20261114-0%20Crosslauf%20S%C3%BClldorf%202026.pdf",
    );
    expect(url).toBe(
      `${ATHLETICON_ORIGIN}/public/ausschreibung/Leichtathletik/20261114-0%20Crosslauf%20S%C3%BClldorf%202026.pdf`,
    );
  });
});
