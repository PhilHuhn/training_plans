import "server-only";
import { env } from "@/server/env";
import { APP_VERSION } from "@/lib/version";
import {
  ATHLETICON_INDEX_URL,
  athleticonDocumentUrl,
  parseAthleticonEvents,
  type AthleticonEvent,
} from "@/lib/athleticon";

// Identify ourselves, with a way to reach the operator: the portal is a small
// volunteer-run PHP site and should be able to tell who is reading it.
const headers = () => ({
  "User-Agent": `ClubTurbine/${APP_VERSION} (+${env.BASE_URL}/imprint)`,
});

export interface AthleticonCalendar {
  events: AthleticonEvent[];
  /** When the portal was actually asked, which may be up to 30 minutes ago. */
  fetchedAt: Date;
}

export async function fetchAthleticonCalendar(): Promise<AthleticonCalendar> {
  const res = await fetch(ATHLETICON_INDEX_URL, {
    headers: headers(),
    signal: AbortSignal.timeout(8000),
    // The first use of Next's data cache in this app. Everything else here is
    // per-user and must not be cached; this is one public page that changes a
    // few times a week, and without the cache every visitor of ours would turn
    // into a request against somebody else's server.
    next: { revalidate: 1800 },
  });
  if (!res.ok) throw new Error(`Athleticon answered ${res.status}`);

  // The portal sends utf-8 today, but it is legacy PHP — follow the header
  // rather than assume, so a change there does not silently garble umlauts.
  const charset = /charset=([^;]+)/i.exec(res.headers.get("content-type") ?? "")?.[1].trim();
  const html = new TextDecoder(charset || "utf-8").decode(await res.arrayBuffer());

  // A cached response keeps its original Date header, so this is the time of
  // the real fetch and not of this render.
  const date = res.headers.get("date");
  return { events: parseAthleticonEvents(html), fetchedAt: date ? new Date(date) : new Date() };
}

/**
 * Fetches an announcement PDF. `path` must have passed
 * `isAthleticonDocumentPath`. Not cached by Next: the data cache caps entries
 * at 2 MB, which a PDF exceeds — the proxy route sets browser caching instead.
 */
export function fetchAthleticonDocument(path: string): Promise<Response> {
  return fetch(athleticonDocumentUrl(path), {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
}
