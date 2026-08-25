import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareKinds, latestVersion, parseChangelog, splitEmphasis } from "../changelog";

const SAMPLE = `# Changelog

Some preamble that is not a release.

## [1.1.0] — 2026-08-25

### Added
- A thing you can now do.
- A second thing, whose description happens to wrap
  across two lines of the source file.

### Fixed
- Something that was broken.

## [1.0.0] — 2026-08-24

### Changed
- The first release.
`;

describe("parseChangelog", () => {
  it("reads releases newest-first, as written", () => {
    expect(parseChangelog(SAMPLE).map((r) => r.version)).toEqual(["1.1.0", "1.0.0"]);
  });

  it("keeps the date off the heading", () => {
    expect(parseChangelog(SAMPLE)[0].date).toBe("2026-08-25");
  });

  it("tags each note with the group it sits under", () => {
    const [latest] = parseChangelog(SAMPLE);
    expect(latest.changes.map((c) => c.kind)).toEqual(["Added", "Added", "Fixed"]);
  });

  it("joins a note that wraps across lines", () => {
    // Notes are prose and wrap in the source; truncating at the first newline
    // would cut a sentence mid-clause on the page.
    expect(parseChangelog(SAMPLE)[0].changes[1].text).toBe(
      "A second thing, whose description happens to wrap across two lines of the source file.",
    );
  });

  it("ignores preamble above the first release", () => {
    expect(parseChangelog(SAMPLE)).toHaveLength(2);
  });

  it("accepts a heading with no date, for a section not yet released", () => {
    const [release] = parseChangelog("## [2.0.0]\n\n### Added\n- Soon.\n");
    expect(release).toMatchObject({ version: "2.0.0", date: "" });
  });

  it("accepts a plain hyphen as the separator", () => {
    expect(parseChangelog("## [1.0.0] - 2026-01-01\n\n- x\n")[0].date).toBe("2026-01-01");
  });

  it("files a note under Other when the group is unrecognised", () => {
    const [release] = parseChangelog("## [1.0.0]\n\n### Surprises\n- Hello.\n");
    expect(release.changes[0].kind).toBe("Other");
  });

  it("keeps a note that appears before any group heading", () => {
    const [release] = parseChangelog("## [1.0.0]\n\n- Loose note.\n");
    expect(release.changes).toEqual([{ kind: "Other", text: "Loose note." }]);
  });

  it("drops a heading with no notes under it, which is a drafting slip", () => {
    expect(parseChangelog("## [9.9.9] — 2026-01-01\n\n### Added\n")).toEqual([]);
  });

  it("returns [] for an empty or note-free file rather than throwing", () => {
    // This renders the page's empty state; an exception would render an error.
    expect(parseChangelog("")).toEqual([]);
    expect(parseChangelog("# Changelog\n\nNothing yet.\n")).toEqual([]);
  });
});

describe("latestVersion", () => {
  it("is the version at the top of the file", () => {
    expect(latestVersion(SAMPLE)).toBe("1.1.0");
  });

  it("is empty when there are no releases", () => {
    expect(latestVersion("# Changelog\n")).toBe("");
  });
});

describe("splitEmphasis", () => {
  it("pulls bold runs out of a note", () => {
    expect(splitEmphasis("the **Import Plan** button")).toEqual([
      { text: "the ", bold: false },
      { text: "Import Plan", bold: true },
      { text: " button", bold: false },
    ]);
  });

  it("handles several bold runs", () => {
    expect(splitEmphasis("**A** and **B**").filter((s) => s.bold).map((s) => s.text)).toEqual([
      "A",
      "B",
    ]);
  });

  it("returns plain text untouched", () => {
    expect(splitEmphasis("nothing special")).toEqual([{ text: "nothing special", bold: false }]);
  });

  it("leaves an unclosed marker alone rather than eating the rest of the line", () => {
    expect(splitEmphasis("an **unclosed marker")).toEqual([
      { text: "an **unclosed marker", bold: false },
    ]);
  });
});

describe("compareKinds", () => {
  it("orders Added before Changed before Fixed, with Other last", () => {
    const shuffled = ["Other", "Fixed", "Added", "Changed"] as const;
    expect([...shuffled].sort(compareKinds)).toEqual(["Added", "Changed", "Fixed", "Other"]);
  });
});

describe("the shipped CHANGELOG.md", () => {
  const root = path.resolve(__dirname, "../../..");
  const markdown = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
    version: string;
  };

  it("parses into at least one release", () => {
    expect(parseChangelog(markdown).length).toBeGreaterThan(0);
  });

  it("agrees with package.json about the current version", () => {
    // The two files state the same fact, and there is no CI in this repo — so
    // this test is the only thing standing between them and silent drift.
    // If this fails, you bumped one and not the other; `npm run release` does both.
    expect(pkg.version).toBe(latestVersion(markdown));
  });

  it("dates every release, so nothing ships as an undated draft", () => {
    for (const release of parseChangelog(markdown)) {
      expect(release.date, `v${release.version} has no date`).not.toBe("");
    }
  });
});
