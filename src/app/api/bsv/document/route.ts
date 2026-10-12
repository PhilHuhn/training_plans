import { isAthleticonDocumentPath } from "@/lib/athleticon";
import { errorJson } from "@/server/http";
import { fetchAthleticonDocument } from "@/server/services/athleticon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public on purpose (no requireSession): it serves the announcement PDFs for
// the public /bsv calendar, so a visitor's browser never talks to the BSV
// portal itself. The path check is what keeps this from being an open proxy.
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !isAthleticonDocumentPath(path)) {
    return errorJson("Unbekanntes Dokument", 400);
  }

  let upstream: Response;
  try {
    upstream = await fetchAthleticonDocument(path);
  } catch (err) {
    console.error("[bsv] document fetch failed", err);
    return errorJson("Der BSV ist gerade nicht erreichbar", 502);
  }
  if (!upstream.ok) {
    return errorJson("Dokument nicht gefunden", upstream.status === 404 ? 404 : 502);
  }

  return new Response(upstream.body, {
    headers: {
      // Fixed rather than passed through, so whatever the upstream sends can
      // only ever be treated as a PDF.
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
