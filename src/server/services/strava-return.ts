/**
 * Where a Strava OAuth round trip comes back to.
 *
 * Kept as a fixed map keyed by a short token because the key travels to Strava
 * inside `state` and returns from outside our control: resolving it against a
 * whitelist is what stops the callback becoming an open redirect. Pure (no
 * "server-only", no env) so it can be unit-tested on its own.
 */

export const RETURN_TO: Record<string, string> = {
  settings: "/settings",
  welcome: "/welcome",
};

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

  const returnPath = RETURN_TO[keyPart] ?? RETURN_TO[DEFAULT_RETURN_KEY];
  return { userId, returnPath };
}
