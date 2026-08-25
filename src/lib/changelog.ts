/**
 * Parses CHANGELOG.md into the releases the /changelog page renders.
 *
 * The changelog is hand-written for athletes, not generated from git. A commit
 * subject answers "what does this diff do"; a release note answers "what
 * changed for you" — and the page has the second audience. Keeping the notes in
 * a committed file also means the page needs no `.git` directory and no `git`
 * binary at runtime, which is a poor thing for a user-facing page to depend on.
 *
 * Pure — no fs, no server-only — so the format is testable and the release
 * script and the app cannot disagree about what a release looks like.
 */

/** The Keep a Changelog groups we use. Anything else is kept verbatim. */
export type ChangeKind = "Added" | "Changed" | "Fixed" | "Removed" | "Other";

const KNOWN_KINDS: ChangeKind[] = ["Added", "Changed", "Fixed", "Removed"];

export interface ReleaseChange {
  kind: ChangeKind;
  text: string;
}

export interface Release {
  version: string;
  /** ISO date, or "" when the heading omits one (an unreleased section). */
  date: string;
  changes: ReleaseChange[];
}

/** `## [1.1.0] — 2026-08-25`, tolerating an em dash, a hyphen, or no date at all. */
const HEADING_RE = /^##\s+\[?([0-9]+\.[0-9]+\.[0-9]+)\]?\s*(?:[—–-]\s*(\d{4}-\d{2}-\d{2}))?\s*$/;
const KIND_RE = /^###\s+(.+?)\s*$/;
const BULLET_RE = /^[-*]\s+(.+?)\s*$/;

function normalizeKind(raw: string): ChangeKind {
  const match = KNOWN_KINDS.find((k) => k.toLowerCase() === raw.trim().toLowerCase());
  return match ?? "Other";
}

/**
 * Reads the file into releases, newest first as written.
 *
 * Deliberately forgiving: an unrecognised `###` group becomes "Other" and a
 * bullet before any group still lands in the release. A typo in a markdown file
 * should not blank the page someone opened to see what changed.
 */
export function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  let current: Release | null = null;
  let kind: ChangeKind = "Other";

  // The last bullet added, so a note wrapped across several lines is joined back
  // together rather than truncated at the first line break. Notes are prose and
  // routinely wrap; losing the tail would cut a sentence mid-clause on the page.
  let openBullet: ReleaseChange | null = null;

  for (const rawLine of markdown.split("\n")) {
    const line = rawLine.trim();

    const heading = HEADING_RE.exec(line);
    if (heading) {
      current = { version: heading[1], date: heading[2] ?? "", changes: [] };
      releases.push(current);
      kind = "Other";
      openBullet = null;
      continue;
    }

    if (!current) continue; // preamble above the first release

    const kindLine = KIND_RE.exec(line);
    if (kindLine) {
      kind = normalizeKind(kindLine[1]);
      openBullet = null;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (bullet) {
      openBullet = { kind, text: bullet[1] };
      current.changes.push(openBullet);
      continue;
    }

    // A blank line ends the bullet; any other text continues it.
    if (!line) {
      openBullet = null;
    } else if (openBullet) {
      openBullet.text += ` ${line}`;
    }
  }

  // A heading with no bullets under it is a drafting mistake, not a release.
  return releases.filter((r) => r.changes.length > 0);
}

/**
 * The version at the top of the file — the one being released.
 *
 * Used by the release script and by the test that keeps package.json in step,
 * so the number in the sidebar always has notes behind it.
 */
export function latestVersion(markdown: string): string {
  return parseChangelog(markdown)[0]?.version ?? "";
}

/** Sorts change kinds into a stable reading order for the page. */
export function compareKinds(a: ChangeKind, b: ChangeKind): number {
  const order: ChangeKind[] = [...KNOWN_KINDS, "Other"];
  return order.indexOf(a) - order.indexOf(b);
}

/** One run of note text, flagged if it was wrapped in `**`. */
export interface TextSegment {
  text: string;
  bold: boolean;
}

/**
 * Splits `**emphasis**` out of a note so the page can render it.
 *
 * The notes are markdown written by hand, and bold is what names a button
 * ("the **Import Plan** button"). Without this the asterisks reach the screen.
 * Only bold is supported — the rest of markdown has no business in a one-line
 * release note, and a half-implemented renderer invites worse.
 */
export function splitEmphasis(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), bold: false });
    segments.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), bold: false });

  return segments.length > 0 ? segments : [{ text, bold: false }];
}
