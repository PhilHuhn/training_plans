import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseChangelog } from "@/lib/changelog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The release notes, read from the committed CHANGELOG.md.
 *
 * This used to shell out to `git log` and render commit subjects, which put a
 * diff summary in front of athletes and made a user-facing page depend on
 * `.git` and a `git` binary surviving into the running container. Reading a
 * committed file needs neither.
 *
 * Note this reads from the repo at runtime, which is right for the current
 * deploy (a full checkout, `npm start` from the repo root). Moving to
 * `output: "standalone"` would mean arranging for this file to be copied.
 */
export async function GET() {
  try {
    const file = path.join(process.cwd(), "CHANGELOG.md");
    const markdown = await readFile(file, "utf8");
    return NextResponse.json({ releases: parseChangelog(markdown) });
  } catch (err) {
    // An empty list renders the page's own empty state, which is a better
    // outcome than an error card for something purely informational.
    console.error("[changelog] could not read CHANGELOG.md:", err);
    return NextResponse.json({ releases: [] });
  }
}
