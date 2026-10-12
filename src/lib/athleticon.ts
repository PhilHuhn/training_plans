/**
 * The BSV Hamburg athletics calendar, read from the Athleticon portal.
 *
 * Pure module (no server-only, no env) so the fixture tests can import it; the
 * fetching lives in src/server/services/athleticon.ts.
 *
 * Only the announcements are read. The portal's entry lists and results carry
 * other athletes' names and birth years and are deliberately left alone.
 */
import { parse, type HTMLElement } from "node-html-parser";

export const ATHLETICON_ORIGIN = "https://athleticon.bsvhh.de";

/**
 * The calendar sits on the portal's landing page itself, server-rendered:
 * no frames, no sub-page, no XHR.
 */
export const ATHLETICON_INDEX_URL = `${ATHLETICON_ORIGIN}/public/index.php`;

/** The portal links its PDFs relative to index.php; this is where they resolve to. */
const DOCUMENT_DIR = "/public/ausschreibung/Leichtathletik/";
const DOCUMENT_PATH = /^\/public\/ausschreibung\/Leichtathletik\/[^/\\]+\.pdf$/;
const REGISTRATION_PATH = "/public/anmelden.php";

export interface AthleticonEvent {
  /** Stable across fetches: ISO date plus the slugged title. */
  slug: string;
  title: string;
  /** ISO date, `YYYY-MM-DD`. */
  date: string;
  /** Local Hamburg time, `YYYY-MM-DDTHH:MM`. Absent where the portal shows "-". */
  entryDeadline?: string;
  /** When the announcement was last changed, `YYYY-MM-DDTHH:MM`. */
  updatedAt?: string;
  /** Guest registration on the portal. BSV members enter through their club. */
  registrationUrl?: string;
  /** Percent-encoded path of the announcement PDF, as the portal links it. */
  documentPath?: string;
}

/**
 * The SSRF guard for the document proxy: after decoding, the path must be one
 * PDF directly inside the athletics announcements folder — no traversal, no
 * other folder, no host.
 */
export function isAthleticonDocumentPath(path: string): boolean {
  try {
    return DOCUMENT_PATH.test(decodeURIComponent(path));
  } catch {
    return false;
  }
}

/**
 * The upstream URL for a path that passed `isAthleticonDocumentPath`. The host
 * is always ours to choose; only the file name comes from the caller, and it is
 * re-encoded as a single path segment.
 */
export function athleticonDocumentUrl(path: string): string {
  const filename = decodeURIComponent(path).slice(DOCUMENT_DIR.length);
  return ATHLETICON_ORIGIN + DOCUMENT_DIR + encodeURIComponent(filename);
}

/** `17.10.2026` → `2026-10-17`; `14.10.2026 18:00:00` → `2026-10-14T18:00`. */
function toIso(text: string): string | undefined {
  const m = /(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(text);
  if (!m) return undefined;
  const date = `${m[3]}-${m[2]}-${m[1]}`;
  return m[4] ? `${date}T${m[4]}:${m[5]}` : date;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The body rows of the table under the card titled `heading`. */
function rowsOf(root: HTMLElement, heading: string): HTMLElement[] {
  const card = root
    .querySelectorAll(".card-body")
    .find((c) => c.querySelector(".card-title")?.text.trim() === heading);
  return card?.querySelectorAll("tbody tr") ?? [];
}

const cellText = (cell: HTMLElement | undefined) => cell?.text.replace(/\s+/g, " ").trim() ?? "";

export function parseAthleticonEvents(html: string): AthleticonEvent[] {
  const root = parse(html);

  // The registration link is not in the announcements table but in the
  // "Meldungen" one, which repeats date and title. Only that link is taken
  // from it — not the entry lists it also points to.
  const registrations = new Map<string, string>();
  for (const row of rowsOf(root, "Meldungen")) {
    const cells = row.querySelectorAll("td");
    const href = row.querySelector('a[href^="anmelden.php"]')?.getAttribute("href");
    const date = toIso(cellText(cells[0]));
    if (!href || !date) continue;
    const url = new URL(href, ATHLETICON_INDEX_URL);
    if (url.origin !== ATHLETICON_ORIGIN || url.pathname !== REGISTRATION_PATH) continue;
    registrations.set(`${date}|${cellText(cells[1])}`, url.href);
  }

  const events: AthleticonEvent[] = [];
  // Columns: Datum · Veranstaltung · Stand · Meldeschluss
  for (const row of rowsOf(root, "Ausschreibungen")) {
    const cells = row.querySelectorAll("td");
    const date = toIso(cellText(cells[0]));
    const title = cellText(cells[1]);
    if (!date || !title) continue;

    const href = cells[1].querySelector("a")?.getAttribute("href");
    const path = href ? new URL(href, ATHLETICON_INDEX_URL).pathname : undefined;

    events.push({
      slug: `${date}-${slugify(title)}`,
      title,
      date,
      entryDeadline: toIso(cellText(cells[3])),
      updatedAt: toIso(cellText(cells[2])),
      registrationUrl: registrations.get(`${date}|${title}`),
      documentPath: path && isAthleticonDocumentPath(path) ? path : undefined,
    });
  }
  return events;
}
