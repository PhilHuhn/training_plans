/**
 * Pure helpers for club identifiers. Kept free of server-only imports so the
 * Drizzle schema (which supplies `joinCode` as an insert default) and the API
 * routes can share one implementation.
 */

// Crockford-ish alphabet: no O/0 or I/1/L, so a code read aloud or copied off a
// whiteboard cannot be mistyped into a different club.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

export function generateJoinCode(length = CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Codes are stored and compared uppercase; users may type them in any case. */
export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase();
}

/** URL-safe slug from a club name. Truncated to fit clubs.slug (varchar 100). */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
  // A name of pure punctuation or non-Latin script would slugify to "" and
  // collide with itself on the unique index; fall back to a stable stand-in.
  return base || "club";
}
