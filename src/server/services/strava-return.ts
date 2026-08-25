/**
 * Where a Strava OAuth round trip comes back to.
 *
 * Kept as a fixed map keyed by a short token because the key travels to Strava
 * inside `state` and returns from outside our control: resolving it against a
 * whitelist is what stops the callback becoming an open redirect. Pure (no
 * "server-only", no env) so it can be unit-tested on its own.
 */

/**
 * Null-prototype on purpose. With a plain object literal, `"constructor" in
 * RETURN_TO` and `RETURN_TO["__proto__"]` both resolve through Object.prototype,
 * so about a dozen inherited keys pass the whitelist and yield a garbage
 * "path" — the user finishes the OAuth round trip and lands on a 404.
 */
export const RETURN_TO: Record<string, string> = Object.assign(Object.create(null), {
  settings: "/settings",
  welcome: "/welcome",
});

/** Own-property check; `in` would traverse the prototype chain. */
export function isReturnKey(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(RETURN_TO, key);
}

export const DEFAULT_RETURN_KEY = "settings";

export interface StravaState {
  userId: number | null;
  /** Already resolved to a safe in-app path. */
  returnPath: string;
}

/**
 * Parse the `state` Strava hands back.
 *
 * Accepts both the current `"<id>:<key>"` form and the bare `"<id>"` used
 * before return paths existed, so a login already in flight during a deploy
 * still completes.
 */
export function parseStravaState(state: string | null): StravaState {
  const raw = (state ?? "").trim();
  const [idPart, keyPart = ""] = raw.split(":");

  const parsedId = Number(idPart);
  const userId = Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null;

  const returnPath = isReturnKey(keyPart) ? RETURN_TO[keyPart] : RETURN_TO[DEFAULT_RETURN_KEY];
  return { userId, returnPath };
}
