/**
 * Build identity, as shown in the sidebar colophon.
 *
 * The semver alone answers "what release is this"; the commit answers "is the
 * thing I just deployed actually live", which is the question that costs real
 * time when a deploy is slow or a stale process survives a restart.
 *
 * Pure — no React, no env reads of its own — so the formatting is testable and
 * the two callers (sidebar, /api/health) cannot drift.
 */

/** Injected at build time by next.config.ts from package.json. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "";

/**
 * Injected at build time from RENDER_GIT_COMMIT. Empty locally, which is
 * correct — a dev build has no meaningful commit to point at.
 */
export const GIT_COMMIT = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "";

/** Commits are shown at git's usual abbreviation length. */
export function shortCommit(commit: string): string {
  return commit.trim().slice(0, 7);
}

/**
 * The one-line build label, or "" when there is nothing worth showing.
 *
 * Returning "" rather than a placeholder lets the caller omit the element
 * entirely — a colophon reading "v" or "unknown" is worse than no colophon.
 */
export function formatVersion(version: string, commit: string): string {
  const v = version.trim();
  const c = shortCommit(commit);
  if (!v && !c) return "";
  if (!v) return c;
  return c ? `v${v} · ${c}` : `v${v}`;
}

/** The label for this build. */
export function buildLabel(): string {
  return formatVersion(APP_VERSION, GIT_COMMIT);
}
