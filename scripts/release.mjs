#!/usr/bin/env node
/**
 * Cuts a release: dates the top section of CHANGELOG.md and sets the same
 * version in package.json.
 *
 * The two files are the same fact stated twice, so they are written together
 * and a test asserts they agree. Usage:
 *
 *   npm run release 1.2.0
 *
 * Write the notes under an undated `## [1.2.0]` heading first — this dates it.
 * If the heading is missing, one is created and you are told to fill it in.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CHANGELOG = path.join(ROOT, "CHANGELOG.md");
const PACKAGE = path.join(ROOT, "package.json");

const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

/** Newest first, as a comparable tuple. */
function compare(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

const version = process.argv[2];
if (!version) fail("Usage: npm run release <version>   e.g. npm run release 1.2.0");
if (!SEMVER.test(version)) fail(`"${version}" is not a semver like 1.2.0`);

const markdown = readFileSync(CHANGELOG, "utf8");
const pkg = JSON.parse(readFileSync(PACKAGE, "utf8"));

const headings = [...markdown.matchAll(/^##\s+\[?(\d+\.\d+\.\d+)\]?\s*(?:[—–-]\s*(\d{4}-\d{2}-\d{2}))?\s*$/gm)];

// Only a *dated* section counts as released. An undated `## [1.3.0]` is the
// draft you are about to cut, so it must not block itself — that is the normal
// workflow (write the notes, then date them), and counting it here made the
// script refuse every release it was primarily meant to do.
const released = headings.filter((h) => h[2]).map((h) => h[1]);
const highest = released.length ? released.reduce((a, b) => (compare(a, b) > 0 ? a : b)) : "0.0.0";
if (compare(version, highest) <= 0) {
  fail(`${version} is not above the highest released version, ${highest}.`);
}
if (compare(version, pkg.version) <= 0) {
  fail(`${version} is not above package.json's current ${pkg.version}.`);
}

const today = new Date().toISOString().slice(0, 10);
let next;

const undated = headings.find((h) => h[1] === version && !h[2]);
if (undated) {
  next = markdown.replace(undated[0], `## [${version}] — ${today}`);
  console.log(`✓ Dated the existing [${version}] section ${today}`);
} else {
  // No section drafted — insert a stub after the file's preamble so the release
  // is never silently noteless.
  const firstRelease = markdown.search(/^##\s+\[?\d+\.\d+\.\d+/m);
  const at = firstRelease === -1 ? markdown.length : firstRelease;
  const stub = `## [${version}] — ${today}\n\n### Changed\n- TODO: write what changed for the people using the app.\n\n`;
  next = markdown.slice(0, at) + stub + markdown.slice(at);
  console.log(`! No [${version}] section found — inserted a stub. Fill in the TODO before pushing.`);
}

writeFileSync(CHANGELOG, next);
pkg.version = version;
writeFileSync(PACKAGE, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`✓ package.json set to ${version}`);
console.log(`\nNext: review CHANGELOG.md, then commit both files together.`);
